import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateBlockSchema, CreateReportSchema } from '@ekklesia/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { EmailService } from '../email/email.service.js';

/**
 * Reporting and blocking.
 *
 * Both are App Store guideline 1.2 requirements for user-generated content, and
 * both are things this platform needs anyway: a listing that misleads people
 * about a church event wastes someone's Sunday, and a host somebody has had a
 * bad experience with should be avoidable without an appeal to anyone.
 */
@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly email: EmailService,
  ) {}

  /**
   * File a report.
   *
   * Accepted even when the same person has reported the same thing before —
   * deduping would silently swallow a second report, and repeat reports on one
   * listing are a signal worth seeing rather than one worth suppressing.
   */
  async createReport(userId: string, body: unknown) {
    const input = CreateReportSchema.parse(body);

    // Verified rather than trusted: a report against an id that does not exist
    // is either a bug or someone probing, and neither belongs in the queue.
    if (input.eventId) {
      const found = await this.prisma.event.count({ where: { id: input.eventId } });
      if (!found) throw new NotFoundException('Event not found');
    }
    if (input.organizationId) {
      const found = await this.prisma.organization.count({ where: { id: input.organizationId } });
      if (!found) throw new NotFoundException('Organisation not found');
    }
    if (input.userId) {
      const found = await this.prisma.user.count({ where: { id: input.userId } });
      if (!found) throw new NotFoundException('User not found');
    }

    const report = await this.prisma.report.create({
      data: {
        reportedByUserId: userId,
        targetEventId: input.eventId ?? null,
        targetOrgId: input.organizationId ?? null,
        targetUserId: input.userId ?? null,
        reason: input.reason,
        details: input.details ?? null,
      },
      select: { id: true, reason: true, createdAt: true },
    });

    // The Terms commit us to acting within 24 hours, which is only possible if
    // somebody knows a report exists. Fire-and-forget: a failed email must not
    // lose the report that is already saved.
    void this.notifyModerators(report.id, input.reason).catch((e) => {
      this.logger.warn(`Report notification failed: ${(e as Error).message}`);
    });

    return { id: report.id, status: 'OPEN' as const };
  }

  private async notifyModerators(reportId: string, reason: string) {
    const to = process.env.MODERATION_EMAIL;
    if (!to) {
      // Loud, because the 24-hour commitment silently cannot be met without it.
      this.logger.error('MODERATION_EMAIL is not set — nobody is being told about reports');
      return;
    }
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    await this.email.send({
      to,
      subject: `New report: ${reason}`,
      html: `<p>A new report needs review.</p><p><a href="${webUrl}/admin/reports">Open the moderation queue</a></p><p>Report id: ${reportId}</p>`,
      text: `A new report needs review (${reason}).\n${webUrl}/admin/reports\nReport id: ${reportId}\n`,
      tags: [{ name: 'type', value: 'moderation' }],
    });
  }

  /** Block a user or an organisation. Idempotent — blocking twice is fine. */
  async createBlock(userId: string, body: unknown) {
    const input = CreateBlockSchema.parse(body);

    if (input.userId === userId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const existing = await this.prisma.block.findFirst({
      where: {
        blockerId: userId,
        blockedUserId: input.userId ?? null,
        blockedOrgId: input.organizationId ?? null,
      },
      select: { id: true },
    });
    if (existing) return { id: existing.id };

    const block = await this.prisma.block.create({
      data: {
        blockerId: userId,
        blockedUserId: input.userId ?? null,
        blockedOrgId: input.organizationId ?? null,
      },
      select: { id: true },
    });

    await this.audit.write({
      actorUserId: userId,
      action: 'user.block',
      targetType: input.userId ? 'user' : 'organization',
      targetId: (input.userId ?? input.organizationId)!,
    });

    return { id: block.id };
  }

  async removeBlock(userId: string, blockId: string) {
    // Scoped to the caller so a block id cannot be used to unblock for someone else.
    const deleted = await this.prisma.block.deleteMany({
      where: { id: blockId, blockerId: userId },
    });
    if (deleted.count === 0) throw new NotFoundException('Block not found');
  }

  async listBlocks(userId: string) {
    const blocks = await this.prisma.block.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
    });

    // Resolved in one round trip each rather than per row.
    const orgIds = blocks.map((b) => b.blockedOrgId).filter((v): v is string => !!v);
    const userIds = blocks.map((b) => b.blockedUserId).filter((v): v is string => !!v);

    const [orgs, users] = await Promise.all([
      orgIds.length
        ? this.prisma.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true, slug: true },
          })
        : [],
      userIds.length
        ? this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          })
        : [],
    ]);

    const orgById = new Map(orgs.map((o) => [o.id, o]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return blocks.map((b) => ({
      id: b.id,
      kind: b.blockedOrgId ? ('organization' as const) : ('user' as const),
      targetId: (b.blockedOrgId ?? b.blockedUserId)!,
      name: b.blockedOrgId
        ? (orgById.get(b.blockedOrgId)?.name ?? 'Unknown organisation')
        : (userById.get(b.blockedUserId!)?.name ?? 'Deleted account'),
      createdAt: b.createdAt,
    }));
  }

  /** Organisation ids this user has blocked, for filtering feeds. */
  async blockedOrgIds(userId: string | undefined): Promise<string[]> {
    if (!userId) return [];
    const rows = await this.prisma.block.findMany({
      where: { blockerId: userId, blockedOrgId: { not: null } },
      select: { blockedOrgId: true },
    });
    return rows.map((r) => r.blockedOrgId!).filter(Boolean);
  }
}
