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
import { rsvpConfirmationEmail } from '../email/templates/rsvp-confirmation.js';

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly email: EmailService,
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
