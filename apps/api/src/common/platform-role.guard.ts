import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUserService, type AuthedUser } from '../modules/auth/current-user.service.js';
import { PLATFORM_ROLE_KEY } from './decorators.js';

export interface PlatformRequest extends Request {
  user: AuthedUser;
}

/**
 * Platform roles ranked, so a check is "at least this" rather than "exactly
 * this". An admin who cannot open the moderation queue because the queue asks
 * for PLATFORM_MODERATOR is the kind of thing nobody notices until the one
 * person on call cannot act on a report.
 */
const RANK: Record<string, number> = {
  USER: 0,
  PLATFORM_SUPPORT: 1,
  PLATFORM_MODERATOR: 2,
  PLATFORM_ADMIN: 3,
};

/**
 * Auth + platform-role gate for the admin endpoints.
 *
 * Separate from OrgMembershipGuard because these routes are not scoped to an
 * organisation at all — a moderator acts across the whole platform, and there
 * is no org id to resolve.
 *
 * Fails closed: a handler with no @RequirePlatformRole is rejected rather than
 * allowed, so forgetting the decorator cannot silently publish an admin route.
 */
@Injectable()
export class PlatformRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly currentUser: CurrentUserService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<PlatformRequest>();

    const required = this.reflector.getAllAndOverride<string | undefined>(PLATFORM_ROLE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required) {
      throw new ForbiddenException('Missing @RequirePlatformRole() on a platform-admin handler');
    }

    const user = await this.currentUser.fromRequest(req);
    if (!user) throw new UnauthorizedException();
    req.user = user;

    // Read the role from the database rather than trusting the session copy.
    // Better Auth only carries the fields it has been told about, so a role
    // read off the session silently reads as USER; and even once it is
    // carried, it would be a snapshot taken when the session was created —
    // revoking someone's access should take effect now, not whenever their
    // session next refreshes. Admin routes are low-traffic, so the extra
    // query costs nothing that matters.
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { platformRole: true, deletedAt: true },
    });
    if (!row || row.deletedAt) throw new UnauthorizedException();

    const held = RANK[row.platformRole] ?? 0;
    const needed = RANK[required] ?? Number.MAX_SAFE_INTEGER;
    if (held < needed) {
      // Deliberately vague: confirming that an admin area exists at this path
      // is not something an ordinary account needs to learn.
      throw new ForbiddenException('Not available');
    }
    req.user = { ...user, platformRole: row.platformRole };
    return true;
  }
}
