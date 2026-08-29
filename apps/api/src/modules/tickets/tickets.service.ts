import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RsvpSchema, type RsvpInput } from '@ekklesia/shared';
import type { Prisma } from '@prisma/client';
import { randomId } from '../../common/random-id.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { EmailService } from '../email/email.service.js';
import { PushService } from '../push/push.service.js';
import { rsvpConfirmationEmail } from '../email/templates/rsvp-confirmation.js';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly email: EmailService,
    private readonly push: PushService,
  ) {}

  /**
   * Free RSVP — creates `quantity` tickets in a single transaction.
   *
   * Invariants enforced under SERIALIZABLE-style semantics (we use a
   * conditional `updateMany` to atomically check + increment the attendee
   * count; if zero rows match, capacity is exhausted and we abort).
   *
   *   - Event must be PUBLISHED.
   *   - User must not already hold an active RSVP for this event.
   *   - attendeeCount + quantity <= capacity (when capacity is set).
   */
  async rsvp(eventId: string, userId: string, body: unknown) {
    const input: RsvpInput = RsvpSchema.parse(body);

    const result = await this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          endsAt: true,
          capacity: true,
          attendeeCount: true,
          ticketTypes: { select: { id: true, priceMinor: true }, orderBy: { createdAt: 'asc' } },
        },
      });
      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== 'PUBLISHED') {
        throw new ForbiddenException('Event is not open for RSVP');
      }
      if (event.endsAt <= new Date()) {
        throw new ForbiddenException('Event has ended');
      }

      // Free RSVP requires that any ticket types attached are free.
      const paid = event.ticketTypes.find((t) => t.priceMinor > 0);
      if (paid) {
        throw new BadRequestException(
          'This event has paid tickets — use the checkout flow instead',
        );
      }

      // Check existing active RSVP for this user/event.
      const existing = await tx.ticket.findFirst({
        where: {
          eventId,
          userId,
          status: { in: ['RESERVED', 'ISSUED', 'CHECKED_IN'] },
        },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException('You already have an RSVP for this event');
      }

      // Capacity check + atomic reservation. If capacity is set, only update
      // when attendeeCount + quantity stays within bounds.
      if (event.capacity !== null) {
        const reserved = await tx.event.updateMany({
          where: {
            id: eventId,
            attendeeCount: { lte: event.capacity - input.quantity },
          },
          data: { attendeeCount: { increment: input.quantity } },
        });
        if (reserved.count === 0) {
          throw new ConflictException('Event is at capacity');
        }
      } else {
        await tx.event.update({
          where: { id: eventId },
          data: { attendeeCount: { increment: input.quantity } },
        });
      }

      // The default "RSVP" ticket type is the first one, if any. Otherwise
      // create one on the fly. (Phase 3 will let organizers define types.)
      let ticketTypeId = event.ticketTypes[0]?.id;
      if (!ticketTypeId) {
        const tt = await tx.ticketType.create({
          data: {
            eventId,
            name: 'RSVP',
            priceMinor: 0,
            currency: 'GBP',
            quantity: 1_000_000,
          },
          select: { id: true },
        });
        ticketTypeId = tt.id;
      }

      const tickets = [];
      for (let i = 0; i < input.quantity; i++) {
        tickets.push(
          await tx.ticket.create({
            data: {
              code: makeTicketCode(),
              eventId,
              ticketTypeId,
              userId,
              attendeeName: input.attendeeName,
              attendeeEmail: input.attendeeEmail,
              status: 'ISSUED',
              issuedAt: new Date(),
            },
            select: TICKET_DETAIL_SELECT,
          }),
        );
      }
      await tx.ticketType.update({
        where: { id: ticketTypeId },
        data: { sold: { increment: input.quantity } },
      });

      await this.audit.write({
        actorUserId: userId,
        organizationId: event.organizationId,
        action: 'ticket.rsvp',
        targetType: 'event',
        targetId: eventId,
        metadata: { quantity: input.quantity } as Prisma.InputJsonValue,
        tx,
      });

      return { tickets };
    });

    // Fire-and-forget email confirmation. Runs after the transaction commits
    // so the ticket is durable even if Resend hiccups. Errors are swallowed
    // by EmailService.
    // Same fire-and-forget treatment as the email, and for the same reason:
    // the RSVP is already durable, and no notification is worth failing it.
    void this.sendRsvpPush(userId, eventId, result.tickets[0]?.id).catch((err) => {
      this.logger.warn(`RSVP push dispatch failed: ${(err as Error).message}`);
    });

    void this.sendRsvpConfirmation(userId, result.tickets[0]?.id).catch((err) => {
      this.logger.warn(`RSVP email dispatch failed: ${(err as Error).message}`);
    });

    return result;
  }

  /**
   * Composes and sends the RSVP confirmation. Pulls the canonical ticket
   * record (and recipient email) from the DB rather than trusting in-memory
   * state, so any post-commit mutations are reflected.
   */
  /**
   * Confirm the RSVP on the device. Deliberately terse — a notification is read
   * on a lock screen, so the event title carries it and the detail lives in the
   * ticket the tap opens.
   */
  private async sendRsvpPush(userId: string, eventId: string, ticketId: string | undefined) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { title: true },
    });
    if (!event) return;
    await this.push.sendToUsers([userId], {
      title: "You're going",
      body: event.title,
      // Routed on tap: straight to the ticket, which is what someone opening
      // this notification actually wants.
      data: ticketId ? { type: 'ticket', ticketId } : { type: 'event', eventId },
    });
  }

  private async sendRsvpConfirmation(userId: string, ticketId: string | undefined) {
    if (!ticketId) return;
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        code: true,
        attendeeName: true,
        user: { select: { email: true, name: true } },
        event: {
          select: {
            title: true,
            startsAt: true,
            timezone: true,
            isOnline: true,
            slug: true,
            organization: { select: { name: true, slug: true } },
            venue: {
              select: {
                name: true,
                addressLine1: true,
                city: true,
                postalCode: true,
              },
            },
          },
        },
      },
    });
    if (!ticket?.user?.email) return;

    const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
    const venueLine = ticket.event.venue
      ? `${ticket.event.venue.name}, ${ticket.event.venue.addressLine1}, ${ticket.event.venue.city} ${ticket.event.venue.postalCode}`
      : null;

    const tpl = rsvpConfirmationEmail({
      attendeeName: ticket.attendeeName ?? ticket.user.name ?? 'friend',
      organizationName: ticket.event.organization.name,
      eventTitle: ticket.event.title,
      eventStartsAt: ticket.event.startsAt,
      eventTimezone: ticket.event.timezone,
      ticketCode: ticket.code,
      ticketUrl: `${webUrl}/me/tickets/${ticketId}`,
      venueLine,
      isOnline: ticket.event.isOnline,
    });

    await this.email.send({
      to: ticket.user.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      tags: [
        { name: 'kind', value: 'rsvp_confirmation' },
        { name: 'event_slug', value: ticket.event.slug },
      ],
    });
  }

  async listForUser(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId, status: { in: ['ISSUED', 'CHECKED_IN'] } },
      orderBy: { event: { startsAt: 'asc' } },
      select: TICKET_DETAIL_SELECT,
    });
  }

  async getForUser(userId: string, ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: TICKET_DETAIL_SELECT,
    });
    if (!ticket || ticket.userId !== userId) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  /**
   * Toggle whether this ticket's holder appears in the event's public
   * "who's going" list. Owner-only, and freely reversible — visibility is
   * consent, and consent must be withdrawable as easily as it was given.
   */
  async setVisibility(userId: string, ticketId: string, showAsAttending: boolean) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { userId: true },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.userId !== userId) throw new ForbiddenException('Not your ticket');
    return this.prisma.ticket.update({
      where: { id: ticketId },
      data: { showAsAttending },
      select: { id: true, showAsAttending: true },
    });
  }

  async cancelRsvp(userId: string, ticketId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: {
          id: true,
          userId: true,
          eventId: true,
          status: true,
          ticketTypeId: true,
          event: { select: { organizationId: true } },
        },
      });
      if (!ticket || ticket.userId !== userId) {
        throw new NotFoundException('Ticket not found');
      }
      if (ticket.status === 'CANCELLED') {
        throw new ConflictException('Already cancelled');
      }
      if (ticket.status === 'CHECKED_IN') {
        throw new ForbiddenException('Already checked in — contact the organizer');
      }
      await tx.ticket.update({
        where: { id: ticketId },
        data: { status: 'CANCELLED' },
      });
      await tx.event.update({
        where: { id: ticket.eventId },
        data: { attendeeCount: { decrement: 1 } },
      });
      await tx.ticketType.update({
        where: { id: ticket.ticketTypeId },
        data: { sold: { decrement: 1 } },
      });
      await this.audit.write({
        actorUserId: userId,
        organizationId: ticket.event.organizationId,
        action: 'ticket.cancel',
        targetType: 'ticket',
        targetId: ticketId,
        tx,
      });
      return { ok: true };
    });
  }

  /**
   * Every attendee for an event, for the organiser's own door list.
   *
   * Distinct from the public `listPublicAttendees`, which shows only people who
   * opted in and caps at 12. That opt-in governs who is shown *publicly*; the
   * host necessarily knows who holds a ticket to their own event, the same as a
   * paper guest list.
   */
  async listForEvent(eventId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { eventId, status: { in: ['ISSUED', 'CHECKED_IN'] } },
      select: {
        id: true,
        code: true,
        status: true,
        issuedAt: true,
        checkedInAt: true,
        attendeeName: true,
        attendeeEmail: true,
        user: { select: { id: true, name: true, email: true, image: true } },
        ticketType: { select: { id: true, name: true, priceMinor: true, currency: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: tickets.map((t) => ({
        id: t.id,
        code: t.code,
        status: t.status,
        issuedAt: t.issuedAt,
        checkedInAt: t.checkedInAt,
        name: t.attendeeName ?? t.user?.name ?? 'Guest',
        email: t.attendeeEmail ?? t.user?.email ?? null,
        image: t.user?.image ?? null,
        ticketType: t.ticketType,
      })),
      total: tickets.length,
      checkedIn: tickets.filter((t) => t.status === 'CHECKED_IN').length,
    };
  }

  /**
   * Admit a ticket by its code. Idempotency matters more than elegance on a
   * door: a second scan reports who was already admitted and when, rather than
   * silently succeeding or throwing something the scanner cannot explain.
   */
  async checkIn(eventId: string, actorUserId: string, code: string) {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) throw new BadRequestException('Ticket code is required');

    const ticket = await this.prisma.ticket.findFirst({
      where: { eventId, code: trimmed },
      select: {
        id: true,
        status: true,
        checkedInAt: true,
        attendeeName: true,
        user: { select: { name: true } },
        event: { select: { organizationId: true } },
      },
    });
    // Scoped by eventId, so a valid code from another event reads as not found
    // here — which is exactly what the person on the door needs to be told.
    if (!ticket) throw new NotFoundException('No ticket for this event with that code');

    const name = ticket.attendeeName ?? ticket.user?.name ?? 'Guest';

    if (ticket.status === 'CHECKED_IN') {
      // Structured, not just prose: the door UI renders the time in the local
      // format the person reading it expects, rather than showing an ISO string.
      throw new ConflictException({
        statusCode: 409,
        error: 'AlreadyCheckedIn',
        message: `${name} was already checked in`,
        name,
        checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      });
    }
    if (ticket.status !== 'ISSUED') {
      throw new BadRequestException(`Ticket is ${ticket.status.toLowerCase()}`);
    }

    const updated = await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CHECKED_IN',
        checkedInAt: new Date(),
        checkedInById: actorUserId,
      },
      select: { id: true, code: true, status: true, checkedInAt: true },
    });

    await this.audit.write({
      actorUserId,
      organizationId: ticket.event.organizationId,
      action: 'ticket.check_in',
      targetType: 'ticket',
      targetId: ticket.id,
    });

    return { ...updated, name };
  }
}

function makeTicketCode(): string {
  // 14 chars, URL-safe, easy to scan as a QR payload. ~10^21 keyspace.
  return `EK-${randomId(11).toUpperCase()}`;
}

export const TICKET_DETAIL_SELECT = {
  id: true,
  code: true,
  status: true,
  showAsAttending: true,
  issuedAt: true,
  checkedInAt: true,
  attendeeName: true,
  attendeeEmail: true,
  userId: true,
  event: {
    select: {
      id: true,
      slug: true,
      title: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      isOnline: true,
      onlineUrl: true,
      coverImageUrl: true,
      organization: { select: { slug: true, name: true, logoUrl: true } },
      venue: true,
    },
  },
} satisfies Prisma.TicketSelect;
