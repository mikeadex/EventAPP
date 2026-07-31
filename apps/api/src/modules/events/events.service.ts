import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateEventSchema,
  EventSearchSchema,
  UpdateEventSchema,
  slugify,
  type CreateEventInput,
  type EventSearchInput,
  type UpdateEventInput,
} from '@ekklesia/shared';
import type { Prisma } from '@prisma/client';
import { randomId } from '../../common/random-id.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ─── Public discovery ────────────────────────────────────────────────────
  async searchPublic(rawQuery: unknown) {
    const input: EventSearchInput = EventSearchSchema.parse(rawQuery);
    const where: Prisma.EventWhereInput = {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      deletedAt: null,
      ...(input.category && {
        category: input.category.toUpperCase() as Prisma.EventWhereInput['category'],
      }),
      ...((input.startsAfter || input.startsBefore) && {
        startsAt: {
          ...(input.startsAfter && { gte: new Date(input.startsAfter) }),
          ...(input.startsBefore && { lte: new Date(input.startsBefore) }),
        },
      }),
      ...((input.city || input.country) && {
        venue: {
          is: {
            ...(input.city && { city: { equals: input.city, mode: 'insensitive' as const } }),
            ...(input.country && { country: input.country.toUpperCase() }),
          },
        },
      }),
      // "Free" = no paid ticket tier on the event.
      ...(input.free && { ticketTypes: { none: { priceMinor: { gt: 0 } } } }),
      ...(input.q && {
        OR: [
          { title: { contains: input.q, mode: 'insensitive' } },
          { summary: { contains: input.q, mode: 'insensitive' } },
        ],
      }),
    };

    const items = await this.prisma.event.findMany({
      where,
      take: input.limit + 1,
      ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      orderBy: { startsAt: 'asc' },
      select: EVENT_CARD_SELECT,
    });
    const hasMore = items.length > input.limit;
    const trimmed = hasMore ? items.slice(0, input.limit) : items;
    return {
      items: trimmed.map(toEventCard),
      nextCursor: hasMore ? trimmed[trimmed.length - 1]!.id : null,
    };
  }

  /**
   * Public "who's going" list for an event: only ticket holders who opted in
   * via `showAsAttending` (consent is off by default — see schema comment),
   * capped so the endpoint stays cheap and the UI stays a preview. `total`
   * is the full attendee count, opted-in or not.
   */
  async listPublicAttendees(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, status: 'PUBLISHED', visibility: 'PUBLIC', deletedAt: null },
      select: { attendeeCount: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const tickets = await this.prisma.ticket.findMany({
      where: {
        eventId,
        showAsAttending: true,
        status: { in: ['ISSUED', 'CHECKED_IN'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: {
        attendeeName: true,
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // One entry per person even if they hold multiple tickets.
    const seen = new Set<string>();
    const items: { name: string; image: string | null }[] = [];
    for (const t of tickets) {
      const key = t.user?.id ?? `guest:${t.attendeeName ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        name: t.attendeeName ?? t.user?.name ?? 'Guest',
        image: t.user?.image ?? null,
      });
    }
    return { items, total: event.attendeeCount };
  }

  /** Distinct venue cities with published upcoming events (for the location picker). */
  async listCities() {
    const rows = await this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        deletedAt: null,
        startsAt: { gte: new Date() },
        venueId: { not: null },
      },
      select: { venue: { select: { city: true, country: true } } },
      distinct: ['venueId'],
    });
    const seen = new Map<string, { city: string; country: string }>();
    for (const r of rows) {
      if (r.venue) seen.set(`${r.venue.city}|${r.venue.country}`, r.venue);
    }
    return { items: Array.from(seen.values()).sort((a, b) => a.city.localeCompare(b.city)) };
  }

  /**
   * Organizer-scoped events list — includes drafts, scheduled, cancelled, etc.
   * Caller must already have org membership (enforced by the guard).
   */
  /**
   * A single event for its organiser, by id. The public lookup is by slug and
   * only returns published events, so an edit screen had no way to load a
   * draft — or anything it had just changed the slug of.
   */
  async getForOrganizer(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      select: {
        id: true,
        slug: true,
        title: true,
        summary: true,
        description: true,
        category: true,
        status: true,
        visibility: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        isOnline: true,
        onlineUrl: true,
        capacity: true,
        attendeeCount: true,
        coverImageUrl: true,
        publishedAt: true,
        cancelledAt: true,
        organizationId: true,
        venue: true,
        ticketTypes: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            priceMinor: true,
            currency: true,
            quantity: true,
            sold: true,
            perOrderMax: true,
            salesStart: true,
            salesEnd: true,
          },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  async listForOrganization(organizationId: string) {
    return this.prisma.event.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { startsAt: 'asc' }],
      select: {
        id: true,
        slug: true,
        title: true,
        status: true,
        visibility: true,
        startsAt: true,
        endsAt: true,
        timezone: true,
        capacity: true,
        attendeeCount: true,
        coverImageUrl: true,
        publishedAt: true,
        cancelledAt: true,
      },
    });
  }

  async getPublicBySlug(orgSlug: string, eventSlug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        slug: eventSlug,
        deletedAt: null,
        organization: { slug: orgSlug },
        status: 'PUBLISHED',
        visibility: { in: ['PUBLIC', 'UNLISTED'] },
      },
      include: {
        ticketTypes: { orderBy: { createdAt: 'asc' } },
        venue: true,
        organization: {
          select: { id: true, slug: true, name: true, logoUrl: true, country: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }

  // ─── Organizer operations ────────────────────────────────────────────────
  async create(organizationId: string, actorUserId: string, body: unknown) {
    const input: CreateEventInput = CreateEventSchema.parse(body);
    return this.prisma.$transaction(async (tx) => {
      const slug = await this.allocateSlug(tx, organizationId, input.title);

      const venueId = input.venue
        ? (
            await tx.venue.create({
              data: {
                name: input.venue.name,
                addressLine1: input.venue.addressLine1,
                addressLine2: input.venue.addressLine2,
                city: input.venue.city,
                region: input.venue.region,
                postalCode: input.venue.postalCode,
                country: input.venue.country,
                latitude: input.venue.latitude,
                longitude: input.venue.longitude,
              },
            })
          ).id
        : null;

      const event = await tx.event.create({
        data: {
          slug,
          organizationId,
          title: input.title,
          summary: input.summary,
          description: input.description,
          category: input.category.toUpperCase() as Prisma.EventCreateInput['category'],
          visibility: input.visibility.toUpperCase() as Prisma.EventCreateInput['visibility'],
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          timezone: input.timezone,
          isOnline: input.isOnline,
          onlineUrl: input.onlineUrl,
          capacity: input.capacity,
          coverImageUrl: input.coverImageUrl,
          status: 'DRAFT',
          ...(venueId && { venueId }),
        },
        include: { ticketTypes: true, venue: true },
      });

      if (input.ticketTypes.length) {
        await tx.ticketType.createMany({
          data: input.ticketTypes.map((t) => ({
            eventId: event.id,
            name: t.name,
            description: t.description,
            priceMinor: t.priceMinor,
            currency: t.currency,
            quantity: t.quantity,
            perOrderMax: t.perOrderMax,
            salesStart: t.salesStart ? new Date(t.salesStart) : null,
            salesEnd: t.salesEnd ? new Date(t.salesEnd) : null,
          })),
        });
      }

      await this.audit.write({
        actorUserId,
        organizationId,
        action: 'event.create',
        targetType: 'event',
        targetId: event.id,
        tx,
      });
      return event;
    });
  }

  async update(eventId: string, actorUserId: string, body: unknown) {
    const input: UpdateEventInput = UpdateEventSchema.parse(body);
    const existing = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, status: true, startsAt: true, endsAt: true },
    });
    if (!existing) throw new NotFoundException('Event not found');
    if (existing.status === 'CANCELLED') {
      throw new ForbiddenException('Cancelled events cannot be edited');
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.summary !== undefined && { summary: input.summary }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.category && {
          category: input.category.toUpperCase() as Prisma.EventUpdateInput['category'],
        }),
        ...(input.visibility && {
          visibility: input.visibility.toUpperCase() as Prisma.EventUpdateInput['visibility'],
        }),
        ...(input.startsAt && { startsAt }),
        ...(input.endsAt && { endsAt }),
        ...(input.timezone && { timezone: input.timezone }),
        ...(input.isOnline !== undefined && { isOnline: input.isOnline }),
        ...(input.onlineUrl !== undefined && { onlineUrl: input.onlineUrl }),
        ...(input.capacity !== undefined && { capacity: input.capacity }),
        ...(input.coverImageUrl !== undefined && { coverImageUrl: input.coverImageUrl }),
      },
    });

    await this.audit.write({
      actorUserId,
      organizationId: existing.organizationId,
      action: 'event.update',
      targetType: 'event',
      targetId: eventId,
      metadata: input as unknown as Prisma.InputJsonValue,
    });
    return updated;
  }

  async publish(eventId: string, actorUserId: string) {
    const evt = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, organizationId: true, startsAt: true, endsAt: true },
    });
    if (!evt) throw new NotFoundException('Event not found');
    if (evt.status === 'PUBLISHED') {
      throw new ConflictException('Event already published');
    }
    if (evt.status === 'CANCELLED') {
      throw new ConflictException('Cancelled events cannot be republished');
    }
    if (evt.endsAt <= new Date()) {
      throw new BadRequestException('Event end time is in the past');
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    await this.audit.write({
      actorUserId,
      organizationId: evt.organizationId,
      action: 'event.publish',
      targetType: 'event',
      targetId: eventId,
    });
    return updated;
  }

  async cancel(eventId: string, actorUserId: string, reason: string | undefined) {
    const evt = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, organizationId: true },
    });
    if (!evt) throw new NotFoundException('Event not found');
    if (evt.status === 'CANCELLED') {
      throw new ConflictException('Event already cancelled');
    }
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    await this.audit.write({
      actorUserId,
      organizationId: evt.organizationId,
      action: 'event.cancel',
      targetType: 'event',
      targetId: eventId,
      metadata: reason ? ({ reason } as Prisma.InputJsonValue) : undefined,
    });
    return updated;
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────
  private async allocateSlug(
    tx: Prisma.TransactionClient,
    organizationId: string,
    title: string,
  ): Promise<string> {
    const base = slugify(title);
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = attempt === 0 ? base : `${base}-${randomId(5).toLowerCase()}`;
      const clash = await tx.event.findUnique({
        where: { organizationId_slug: { organizationId, slug: candidate } },
        select: { id: true },
      });
      if (!clash) return candidate;
    }
    return `${base}-${randomId(8).toLowerCase()}`;
  }
}

export const EVENT_CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  category: true,
  status: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  isOnline: true,
  capacity: true,
  attendeeCount: true,
  coverImageUrl: true,
  organization: {
    select: { id: true, slug: true, name: true, logoUrl: true, country: true },
  },
  venue: {
    select: { city: true, country: true },
  },
  ticketTypes: {
    select: { priceMinor: true, currency: true },
  },
} satisfies Prisma.EventSelect;

/** Flatten card rows: replace raw ticketTypes with isFree + minPriceMinor. */
export function toEventCard<
  T extends { ticketTypes: { priceMinor: number; currency: string }[] },
>(row: T) {
  const { ticketTypes, ...rest } = row;
  const prices = ticketTypes.map((t) => t.priceMinor);
  const minPriceMinor = prices.length ? Math.min(...prices) : 0;
  return {
    ...rest,
    isFree: minPriceMinor === 0,
    minPriceMinor,
    currency: ticketTypes[0]?.currency ?? null,
  };
}
