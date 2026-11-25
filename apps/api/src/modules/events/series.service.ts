import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { slugify } from '@ekklesia/shared';
import {
  DEFAULT_HORIZON_DAYS,
  describeRecurrence,
  expandRecurrence,
  type RecurrenceFreq,
  type RecurrenceRule,
} from './recurrence.js';

/**
 * Repeating events.
 *
 * Every occurrence is an ordinary `Event` row with a `seriesId`. Nothing
 * downstream — tickets, orders, check-in, saved events — knows a series
 * exists, which is the point: a weekly service behaves exactly like twelve
 * separate events that happen to share a title, because that is what it is.
 */
@Injectable()
export class SeriesService {
  private readonly logger = new Logger(SeriesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * Create a series and materialise its occurrences.
   *
   * The whole thing is one transaction. A series whose first three
   * occurrences were created and whose fourth failed would leave an organiser
   * with a half-made schedule and no way to tell which dates are real.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    input: {
      title: string;
      summary?: string | null;
      description?: string | null;
      category: string;
      visibility: string;
      startsAt: string;
      endsAt: string;
      timezone: string;
      isOnline?: boolean;
      onlineUrl?: string | null;
      venueId?: string | null;
      capacity?: number | null;
      coverImageUrl?: string | null;
      ticketTypes?: {
        name: string;
        description?: string | null;
        priceMinor: number;
        currency: string;
        quantity: number;
        perOrderMax?: number;
      }[];
      recurrence: {
        freq: RecurrenceFreq;
        interval?: number;
        byWeekday?: number[];
        nthWeekday?: number | null;
        until?: string | null;
        count?: number | null;
      };
    },
  ) {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (!(endsAt > startsAt)) {
      throw new BadRequestException('endsAt must be after startsAt');
    }
    const durationMinutes = Math.round((endsAt.getTime() - startsAt.getTime()) / 60000);

    const rule: RecurrenceRule = {
      freq: input.recurrence.freq,
      interval: input.recurrence.interval,
      byWeekday: input.recurrence.byWeekday,
      nthWeekday: input.recurrence.nthWeekday,
      startsAt,
      until: input.recurrence.until ? new Date(input.recurrence.until) : null,
      count: input.recurrence.count ?? null,
    };

    const dates = expandRecurrence(rule);
    if (dates.length === 0) {
      // Only reachable if `until` is before the start, which is worth saying
      // plainly rather than silently creating an empty series.
      throw new BadRequestException('That pattern produces no dates. Check the end date.');
    }

    return this.prisma.$transaction(async (tx) => {
      const series = await tx.eventSeries.create({
        data: {
          organizationId,
          freq: input.recurrence.freq,
          interval: input.recurrence.interval ?? (input.recurrence.freq === 'FORTNIGHTLY' ? 2 : 1),
          byWeekday: input.recurrence.byWeekday ?? [],
          nthWeekday: input.recurrence.nthWeekday ?? null,
          startsAt,
          durationMinutes,
          timezone: input.timezone,
          until: rule.until,
          count: rule.count,
          generatedUntil: dates[dates.length - 1]!,
        },
      });

      const base = slugify(input.title);
      // The first occurrence leads. Discovery shows exactly one card per
      // series; a cron moves the flag on as each date passes.
      const created = [];
      for (const [index, occurrenceStart] of dates.entries()) {
        const event = await tx.event.create({
          data: {
            slug: await this.occurrenceSlug(tx, organizationId, base, occurrenceStart),
            organizationId,
            seriesId: series.id,
            seriesLead: index === 0,
            title: input.title,
            summary: input.summary,
            description: input.description,
            category: input.category.toUpperCase() as Prisma.EventCreateInput['category'],
            visibility: input.visibility.toUpperCase() as Prisma.EventCreateInput['visibility'],
            startsAt: occurrenceStart,
            endsAt: new Date(occurrenceStart.getTime() + durationMinutes * 60000),
            timezone: input.timezone,
            isOnline: input.isOnline ?? false,
            onlineUrl: input.onlineUrl,
            capacity: input.capacity,
            coverImageUrl: input.coverImageUrl,
            status: 'DRAFT',
            ...(input.venueId && { venueId: input.venueId }),
          },
          select: { id: true, slug: true, startsAt: true },
        });

        // Ticket types are per occurrence, not per series. Capacity has to be
        // countable for one date — "20 seats" means twenty seats this Sunday,
        // not twenty across the year.
        if (input.ticketTypes?.length) {
          await tx.ticketType.createMany({
            data: input.ticketTypes.map((t) => ({
              eventId: event.id,
              name: t.name,
              description: t.description,
              priceMinor: t.priceMinor,
              currency: t.currency,
              quantity: t.quantity,
              ...(t.perOrderMax != null && { perOrderMax: t.perOrderMax }),
            })),
          });
        }
        created.push(event);
      }

      await this.audit.write({
        actorUserId,
        organizationId,
        action: 'event_series.create',
        targetType: 'event_series',
        targetId: series.id,
        metadata: {
          occurrences: created.length,
          pattern: describeRecurrence(rule),
        } as Prisma.InputJsonValue,
        tx,
      });

      return {
        series: { ...series, description: describeRecurrence(rule) },
        occurrences: created,
      };
    });
  }

  /**
   * A slug that says which date it is.
   *
   * Twelve occurrences cannot share one slug — the unique is
   * (organizationId, slug) — and letting `allocateSlug` append random
   * characters would give an organiser twelve URLs they cannot tell apart.
   * The date is the thing that distinguishes them, so it goes in the slug.
   */
  private async occurrenceSlug(
    tx: Prisma.TransactionClient,
    organizationId: string,
    base: string,
    date: Date,
  ): Promise<string> {
    const stamp = date.toISOString().slice(0, 10);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? `${base}-${stamp}` : `${base}-${stamp}-${attempt + 1}`;
      const clash = await tx.event.findUnique({
        where: { organizationId_slug: { organizationId, slug: candidate } },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    return `${base}-${stamp}-${Date.now().toString(36)}`;
  }

  /** The series behind an occurrence, with its human description. */
  async getForEvent(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { seriesId: true },
    });
    if (!event?.seriesId) return null;
    return this.describe(event.seriesId);
  }

  async describe(seriesId: string) {
    const series = await this.prisma.eventSeries.findUnique({ where: { id: seriesId } });
    if (!series) throw new NotFoundException('Series not found');
    return {
      id: series.id,
      description: describeRecurrence({
        freq: series.freq as RecurrenceFreq,
        interval: series.interval,
        byWeekday: series.byWeekday,
        nthWeekday: series.nthWeekday,
        startsAt: series.startsAt,
        until: series.until,
        count: series.count,
      }),
      freq: series.freq,
      interval: series.interval,
      byWeekday: series.byWeekday,
      nthWeekday: series.nthWeekday,
      until: series.until,
      count: series.count,
      cancelledAt: series.cancelledAt,
    };
  }

  /**
   * Publish, cancel or delete every occurrence that has not happened yet.
   *
   * Past occurrences are left exactly as they are. They have tickets against
   * them and people attended them; rewriting history to tidy up a schedule
   * would be wrong, and cancelling an event someone already went to would be
   * worse.
   */
  async applyToFuture(seriesId: string, actorUserId: string, action: 'publish' | 'cancel') {
    const series = await this.prisma.eventSeries.findUnique({
      where: { id: seriesId },
      select: { id: true, organizationId: true },
    });
    if (!series) throw new NotFoundException('Series not found');

    const now = new Date();
    const data =
      action === 'publish'
        ? { status: 'PUBLISHED' as const, publishedAt: now }
        : { status: 'CANCELLED' as const, cancelledAt: now };

    const result = await this.prisma.event.updateMany({
      where: { seriesId, startsAt: { gt: now }, deletedAt: null },
      data,
    });

    if (action === 'cancel') {
      await this.prisma.eventSeries.update({
        where: { id: seriesId },
        data: { cancelledAt: now },
      });
    }

    await this.audit.write({
      actorUserId,
      organizationId: series.organizationId,
      action: `event_series.${action}`,
      targetType: 'event_series',
      targetId: seriesId,
      metadata: { occurrences: result.count } as Prisma.InputJsonValue,
    });

    return { updated: result.count };
  }

  /**
   * Move `seriesLead` to the next occurrence that has not started, and top up
   * series whose horizon is running out.
   *
   * Run on a schedule. Without the first half, a series disappears from
   * discovery the moment its lead occurrence starts; without the second, an
   * open-ended series quietly stops having dates six months in.
   */
  async rollLeads(now = new Date()) {
    // Series with at least one occurrence that has already started while
    // still holding the lead.
    const stale = await this.prisma.event.findMany({
      where: { seriesLead: true, seriesId: { not: null }, startsAt: { lte: now } },
      select: { id: true, seriesId: true },
    });

    let moved = 0;
    for (const lead of stale) {
      const next = await this.prisma.event.findFirst({
        where: {
          seriesId: lead.seriesId,
          startsAt: { gt: now },
          deletedAt: null,
          status: { not: 'CANCELLED' },
        },
        orderBy: { startsAt: 'asc' },
        select: { id: true },
      });
      await this.prisma.$transaction(async (tx) => {
        await tx.event.update({ where: { id: lead.id }, data: { seriesLead: false } });
        if (next) {
          await tx.event.update({ where: { id: next.id }, data: { seriesLead: true } });
        }
      });
      moved += 1;
    }

    const topped = await this.topUp(now);
    if (moved || topped) {
      this.logger.log(`Series: moved ${moved} lead(s), topped up ${topped} series`);
    }
    return { moved, topped };
  }

  /**
   * Extend series that are running out of generated occurrences.
   *
   * Only those with no end condition already satisfied, and only up to the
   * same horizon the first batch used, so this stays a steady trickle rather
   * than a cliff.
   */
  private async topUp(now: Date): Promise<number> {
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const running = await this.prisma.eventSeries.findMany({
      where: {
        cancelledAt: null,
        generatedUntil: { lt: soon },
        OR: [{ until: null }, { until: { gt: now } }],
        count: null, // a fixed-count series is finished when it is finished
      },
      take: 25,
    });

    let extended = 0;
    for (const series of running) {
      const from = series.generatedUntil ?? series.startsAt;
      const dates = expandRecurrence(
        {
          freq: series.freq as RecurrenceFreq,
          interval: series.interval,
          byWeekday: series.byWeekday,
          nthWeekday: series.nthWeekday,
          startsAt: from,
          until: series.until,
          count: null,
        },
        { horizonDays: DEFAULT_HORIZON_DAYS },
      ).filter((d) => d > from);

      if (dates.length === 0) continue;

      const template = await this.prisma.event.findFirst({
        where: { seriesId: series.id },
        orderBy: { startsAt: 'desc' },
        include: { ticketTypes: true },
      });
      if (!template) continue;

      const base = slugify(template.title);
      await this.prisma.$transaction(async (tx) => {
        for (const date of dates) {
          const event = await tx.event.create({
            data: {
              slug: await this.occurrenceSlug(tx, series.organizationId, base, date),
              organizationId: series.organizationId,
              seriesId: series.id,
              seriesLead: false,
              title: template.title,
              summary: template.summary,
              description: template.description,
              category: template.category,
              visibility: template.visibility,
              startsAt: date,
              endsAt: new Date(date.getTime() + series.durationMinutes * 60000),
              timezone: series.timezone,
              isOnline: template.isOnline,
              onlineUrl: template.onlineUrl,
              capacity: template.capacity,
              coverImageUrl: template.coverImageUrl,
              venueId: template.venueId,
              // Matches what the rest of the series is doing, so a published
              // series keeps publishing and a draft one stays a draft.
              status: template.status,
              publishedAt: template.status === 'PUBLISHED' ? new Date() : null,
            },
            select: { id: true },
          });
          if (template.ticketTypes.length) {
            await tx.ticketType.createMany({
              data: template.ticketTypes.map((t) => ({
                eventId: event.id,
                name: t.name,
                description: t.description,
                priceMinor: t.priceMinor,
                currency: t.currency,
                quantity: t.quantity,
                perOrderMax: t.perOrderMax,
              })),
            });
          }
        }
        await tx.eventSeries.update({
          where: { id: series.id },
          data: { generatedUntil: dates[dates.length - 1]! },
        });
      });
      extended += 1;
    }
    return extended;
  }
}
