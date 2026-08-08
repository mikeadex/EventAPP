import {
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service.js';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module.js';
import { DEFAULT_ORG_PERMISSIONS, type Permission } from '@ekklesia/shared';
import type { OrgRole as PrismaOrgRole } from '@prisma/client';
import { SavedEventsController } from './saved-events.controller.js';

@Controller('me')
@UseGuards(AuthGuard)
class MeController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagsService,
    private readonly audit: AuditLogService,
  ) {}

  @Get()
  async me(@Req() req: AuthedRequest) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        profile: true,
        memberships: {
          include: {
            organization: {
              select: { id: true, slug: true, name: true, verificationStatus: true },
            },
          },
        },
      },
    });
    if (!user) return null;

    const permissionsByOrg: Record<string, Permission[]> = {};
    for (const m of user.memberships) {
      const role = m.role.toLowerCase() as keyof typeof DEFAULT_ORG_PERMISSIONS;
      permissionsByOrg[m.organizationId] = DEFAULT_ORG_PERMISSIONS[role] ?? [];
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      platformRole: user.platformRole,
      profile: user.profile,
      memberships: user.memberships.map((m) => ({
        organizationId: m.organizationId,
        slug: m.organization.slug,
        name: m.organization.name,
        role: m.role,
        verificationStatus: m.organization.verificationStatus,
      })),
      permissionsByOrg,
      capabilities: await this.flags.resolveForUser(user.id),
    };
  }

  /**
   * Permanently delete the signed-in user's account.
   *
   * Required by App Store Review Guideline 5.1.1(v): any app offering account
   * creation must offer in-app account deletion.
   *
   * Financial and trust & safety records (tickets, orders, donations, reports,
   * moderation actions, audit log) are NOT destroyed — their `userId` columns
   * are nullable and set to NULL by the database, so the records survive in
   * anonymised form. Personal data (profile, sessions, credentials, saved
   * events, notification prefs, org memberships) cascades away with the user.
   *
   * Blocked when the caller is the last OWNER of an organization: deleting
   * them would strand the org and its events with nobody able to administer
   * them. They must transfer ownership or delete the org first.
   */
  @Delete()
  @HttpCode(204)
  async deleteAccount(@Req() req: AuthedRequest) {
    const userId = req.user.id;

    const ownedOrgs = await this.prisma.organizationMembership.findMany({
      where: { userId, role: 'OWNER' },
      select: { organizationId: true, organization: { select: { name: true } } },
    });

    if (ownedOrgs.length > 0) {
      const orgIds = ownedOrgs.map((m) => m.organizationId);
      const otherOwners = await this.prisma.organizationMembership.groupBy({
        by: ['organizationId'],
        where: { organizationId: { in: orgIds }, role: 'OWNER', userId: { not: userId } },
        _count: { _all: true },
      });
      const withOtherOwner = new Set(otherOwners.map((o) => o.organizationId));
      const stranded = ownedOrgs.filter((m) => !withOtherOwner.has(m.organizationId));

      if (stranded.length > 0) {
        throw new ConflictException({
          code: 'SOLE_OWNER',
          message:
            'You are the only owner of an organisation. Transfer ownership or delete the organisation before deleting your account.',
          organizations: stranded.map((m) => ({
            id: m.organizationId,
            name: m.organization.name,
          })),
        });
      }
    }

    // Written before the delete: the audit row's actorUserId is SET NULL by the
    // FK, so it survives as an anonymous record that a deletion occurred.
    await this.audit.write({
      actorUserId: userId,
      action: 'user.delete',
      targetType: 'user',
      targetId: userId,
      req,
    });

    await this.prisma.user.delete({ where: { id: userId } });
  }
}

@Module({
  imports: [AuthModule, FeatureFlagsModule],
  controllers: [MeController, SavedEventsController],
})
export class UsersModule {}

// Suppress unused import warning for PrismaOrgRole — referenced indirectly via Prisma types.
void (null as PrismaOrgRole | null);
