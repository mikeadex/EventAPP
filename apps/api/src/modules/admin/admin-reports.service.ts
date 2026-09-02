import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';

/** Actions a moderator can take from the queue. */
const ACTIONS = ['takedown_event', 'warn', 'dismiss'] as const;
export type ModerationActionKind = (typeof ACTIONS)[number];

const STATUSES = ['OPEN', 'REVIEWING', 'ACTION_TAKEN', 'DISMISSED'] as const;
type Status = (typeof STATUSES)[number];

/**
 * The moderation queue.
 *
 * Exists because the Terms commit us to reviewing every report and acting on
 * objectionable content within 24 hours. Storing reports and emailing about
 * them is not the same as being able to act on one, and a commitment with no
 * mechanism behind it is worse than no commitment.
 *
 * Every decision — including dismissing — writes a ModerationAction row. The
 * record of what we decided and why is the thing that matters later, whether
 * that is an appeal, an ICO question, or App Review asking how this works.
 */
@Injectable()
export class AdminReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * The queue itself. Oldest first, because the 24-hour clock starts when a
   * report is filed — newest-first would let the oldest report age out of
   * sight, which is exactly the one at risk of breaching the commitment.
   */
  async list(status: string | undefined, take = 50) {
    const where: Prisma.ReportWhereInput = {};
    if (status && status !== 'ALL') {
      if (!STATUSES.includes(status as Status)) {
        throw new BadRequestException(`Unknown status: ${status}`);
      }
      where.status = status as Status;
    }

    const reports = await this.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: Math.min(take, 200),
      select: {
        id: true,
        reason: true,
        details: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        reportedByUserId: true,
        reportedBy: { select: { email: true } },
        targetEventId: true,
        targetEvent: {
          select: { id: true, title: true, slug: true, status: true, organizationId: true },
        },
        targetOrgId: true,
        targetOrg: { select: { id: true, name: true, slug: true } },
        targetUserId: true,
        actions: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            note: true,
            createdAt: true,
            actor: { select: { email: true } },
          },
        },
      },
    });

    // Reported users have no relation on Report (targetUserId is a bare
    // column so the row survives the account being deleted), so resolve the
    // names in one query rather than leaving the queue showing raw ids.
    const userIds = reports.map((r) => r.targetUserId).filter((v): v is string => !!v);
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    return reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
      reporter: r.reportedBy?.email ?? (r.reportedByUserId ? 'Unknown' : 'Deleted account'),
      target: r.targetEvent
        ? {
            kind: 'event' as const,
            id: r.targetEvent.id,
            label: r.targetEvent.title,
            slug: r.targetEvent.slug,
            status: r.targetEvent.status,
          }
        : r.targetOrg
          ? {
              kind: 'organization' as const,
              id: r.targetOrg.id,
              label: r.targetOrg.name,
              slug: r.targetOrg.slug,
              status: null,
            }
          : r.targetUserId
            ? {
                kind: 'user' as const,
                id: r.targetUserId,
                label:
                  userById.get(r.targetUserId)?.email ??
                  userById.get(r.targetUserId)?.name ??
                  'Deleted account',
                slug: null,
                status: null,
              }
            : { kind: 'unknown' as const, id: '', label: 'Target missing', slug: null, status: null },
      actions: r.actions.map((a) => ({
        id: a.id,
        action: a.action,
        note: a.note,
        createdAt: a.createdAt,
        actor: a.actor?.email ?? 'Removed account',
      })),
    }));
  }

  /** Counts for the filter tabs, so the queue depth is visible at a glance. */
  async counts() {
    const rows = await this.prisma.report.groupBy({
      by: ['status'],
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count._all]));
    return {
      OPEN: byStatus.OPEN ?? 0,
      REVIEWING: byStatus.REVIEWING ?? 0,
      ACTION_TAKEN: byStatus.ACTION_TAKEN ?? 0,
      DISMISSED: byStatus.DISMISSED ?? 0,
    };
  }

  /** Claim a report, so two moderators don't work the same one. */
  async startReview(actorUserId: string, reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'OPEN') {
      throw new BadRequestException(`Report is already ${report.status}`);
    }
    await this.prisma.report.update({
      where: { id: reportId },
      data: { status: 'REVIEWING' },
    });
    await this.audit.write({
      actorUserId,
      action: 'moderation.review',
      targetType: 'report',
      targetId: reportId,
    });
    return { status: 'REVIEWING' as const };
  }

  /**
   * Resolve a report by taking an action.
   *
   * The content change and the record of it are written in one transaction:
   * a takedown with no ModerationAction row would leave us unable to say who
   * removed an organiser's event or why, which is the first thing asked in an
   * appeal.
   */
  async resolve(
    actorUserId: string,
    reportId: string,
    body: { action?: unknown; note?: unknown },
  ) {
    const action = body.action;
    if (typeof action !== 'string' || !ACTIONS.includes(action as ModerationActionKind)) {
      throw new BadRequestException(`action must be one of: ${ACTIONS.join(', ')}`);
    }
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : null;

    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, targetEventId: true, targetOrgId: true, targetUserId: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status === 'ACTION_TAKEN' || report.status === 'DISMISSED') {
      throw new BadRequestException('Report is already resolved');
    }

    if (action === 'takedown_event' && !report.targetEventId) {
      throw new BadRequestException('This report is not about an event');
    }

    const targetType = report.targetEventId
      ? 'event'
      : report.targetOrgId
        ? 'organization'
        : 'user';
    const targetId = report.targetEventId ?? report.targetOrgId ?? report.targetUserId ?? '';

    await this.prisma.$transaction(async (tx) => {
      if (action === 'takedown_event' && report.targetEventId) {
        // Unpublished rather than cancelled: CANCELLED emails every attendee
        // that the event is off, which is the organiser's message to send,
        // not ours. DRAFT takes it out of public view and is reversible if
        // the appeal succeeds.
        await tx.event.update({
          where: { id: report.targetEventId },
          data: { status: 'DRAFT' },
        });
      }

      await tx.moderationAction.create({
        data: {
          reportId: report.id,
          actorUserId,
          action,
          targetType,
          targetId,
          note,
        },
      });

      await tx.report.update({
        where: { id: report.id },
        data: {
          status: action === 'dismiss' ? 'DISMISSED' : 'ACTION_TAKEN',
          resolvedAt: new Date(),
        },
      });
    });

    await this.audit.write({
      actorUserId,
      action: `moderation.${action}`,
      targetType,
      targetId,
      metadata: { reportId: report.id },
    });

    return { status: action === 'dismiss' ? ('DISMISSED' as const) : ('ACTION_TAKEN' as const) };
  }
}
