import { Injectable, NotFoundException } from '@nestjs/common';
import { AdminUnpublishSchema } from '@ekklesia/shared';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditLogService } from '../../common/audit-log.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EventsService } from '../events/events.service.js';

const ListEventsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'live', 'ended', 'unpublished']).default('all'),
});

/** Every event on the platform, for staff; and taking one down. */
@Injectable()
export class AdminEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventsService,
  ) {}

  /**
   * Live: published and not over. Ended: published (or completed) and over.
   * Unpublished: cancelled, by its host, a take-down or staff. Drafts are a
   * host's unfinished work and appear under none of them.
   */
  async list(query: unknown) {
    const input = ListEventsSchema.parse(query ?? {});
    const q = input.q || undefined;
    const now = new Date();
    const byStatus: Record<typeof input.status, Prisma.EventWhereInput> = {
      all: { status: { not: 'DRAFT' } },
      live: { status: 'PUBLISHED', endsAt: { gte: now } },
      ended: { status: { in: ['PUBLISHED', 'COMPLETED'] }, endsAt: { lt: now } },
      unpublished: { status: 'CANCELLED' },
    };
    const items = await this.prisma.event.findMany({
      where: {
        deletedAt: null,
        organization: { is: { deletedAt: null } },
        ...byStatus[input.status],
        ...(q && {
          OR: [
            { title: { contains: q, mode: 'insensitive' as const } },
            { organization: { is: { name: { contains: q, mode: 'insensitive' as const } } } },
          ],
        }),
      },
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        startsAt: true,
        endsAt: true,
        attendeeCount: true,
        capacity: true,
        publishedAt: true,
        cancelledAt: true,
        organization: { select: { id: true, slug: true, name: true, claimStatus: true } },
      },
      orderBy: { startsAt: 'desc' },
      take: 200,
    });
    return { items };
  }

  /** Cancel the event as its host would (ticket holders are told) and audit it. */
  async unpublish(eventId: string, staffId: string, body: unknown, req: Request | undefined) {
    const { reason } = AdminUnpublishSchema.parse(body);
    // The same events the staff list shows: no drafts, nothing deleted.
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        deletedAt: null,
        status: { not: 'DRAFT' },
        organization: { is: { deletedAt: null } },
      },
      select: { organizationId: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    await this.events.cancel(eventId, staffId, reason);
    await this.audit.write({
      actorUserId: staffId,
      organizationId: event.organizationId,
      action: 'admin.event.unpublish',
      targetType: 'event',
      targetId: eventId,
      metadata: { reason },
      req,
    });
    return { id: eventId, status: 'CANCELLED' as const };
  }
}
