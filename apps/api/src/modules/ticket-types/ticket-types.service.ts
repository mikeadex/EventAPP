import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';

/**
 * Organiser-defined ticket types. Until now none of this was reachable: an
 * event created through the UI had no ticket types at all, and RSVP quietly
 * invented a free one on first use. That works for free events and makes paid
 * ticketing impossible to set up, so Stripe had nothing to sell.
 */
const TicketTypeSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  // Minor units (pence). 0 means free.
  priceMinor: z.number().int().min(0).max(1_000_000),
  currency: z
    .string()
    .length(3)
    .transform((c) => c.toUpperCase()),
  quantity: z.number().int().min(1).max(1_000_000),
  perOrderMax: z.number().int().min(1).max(100).default(10),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
});

const UpdateTicketTypeSchema = TicketTypeSchema.partial();

const SELECT = {
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
  createdAt: true,
} as const;

@Injectable()
export class TicketTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list(eventId: string) {
    const items = await this.prisma.ticketType.findMany({
      where: { eventId },
      select: SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return { items };
  }

  async create(eventId: string, actorUserId: string, body: unknown) {
    const input = TicketTypeSchema.parse(body);
    this.assertSaleWindow(input.salesStart, input.salesEnd);

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const created = await this.prisma.ticketType.create({
      data: {
        eventId,
        name: input.name,
        description: input.description,
        priceMinor: input.priceMinor,
        currency: input.currency,
        quantity: input.quantity,
        perOrderMax: input.perOrderMax,
        salesStart: input.salesStart ? new Date(input.salesStart) : null,
        salesEnd: input.salesEnd ? new Date(input.salesEnd) : null,
      },
      select: SELECT,
    });

    await this.audit.write({
      actorUserId,
      organizationId: event.organizationId,
      action: 'ticket_type.create',
      targetType: 'ticket_type',
      targetId: created.id,
    });
    return created;
  }

  async update(
    eventId: string,
    ticketTypeId: string,
    actorUserId: string,
    body: unknown,
  ) {
    const input = UpdateTicketTypeSchema.parse(body);
    const existing = await this.findInEvent(eventId, ticketTypeId);

    const salesStart =
      input.salesStart !== undefined ? new Date(input.salesStart) : existing.salesStart;
    const salesEnd =
      input.salesEnd !== undefined ? new Date(input.salesEnd) : existing.salesEnd;
    this.assertSaleWindow(salesStart?.toISOString(), salesEnd?.toISOString());

    // Capacity can be raised or lowered, but never below what is already sold —
    // that would leave issued tickets over the line.
    if (input.quantity !== undefined && input.quantity < existing.sold) {
      throw new BadRequestException(
        `Quantity cannot be lower than the ${existing.sold} already issued`,
      );
    }
    // Repricing something people already hold is a refund problem, not an edit.
    if (
      input.priceMinor !== undefined &&
      input.priceMinor !== existing.priceMinor &&
      existing.sold > 0
    ) {
      throw new ConflictException(
        'Price cannot change once tickets have been issued — create a new type instead',
      );
    }

    const updated = await this.prisma.ticketType.update({
      where: { id: ticketTypeId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.priceMinor !== undefined && { priceMinor: input.priceMinor }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.quantity !== undefined && { quantity: input.quantity }),
        ...(input.perOrderMax !== undefined && { perOrderMax: input.perOrderMax }),
        ...(input.salesStart !== undefined && { salesStart }),
        ...(input.salesEnd !== undefined && { salesEnd }),
      },
      select: SELECT,
    });

    await this.audit.write({
      actorUserId,
      organizationId: existing.event.organizationId,
      action: 'ticket_type.update',
      targetType: 'ticket_type',
      targetId: ticketTypeId,
    });
    return updated;
  }

  async remove(eventId: string, ticketTypeId: string, actorUserId: string) {
    const existing = await this.findInEvent(eventId, ticketTypeId);
    if (existing.sold > 0) {
      throw new ConflictException(
        'Cannot delete a ticket type that has issued tickets',
      );
    }
    await this.prisma.ticketType.delete({ where: { id: ticketTypeId } });
    await this.audit.write({
      actorUserId,
      organizationId: existing.event.organizationId,
      action: 'ticket_type.delete',
      targetType: 'ticket_type',
      targetId: ticketTypeId,
    });
    return { id: ticketTypeId, deleted: true };
  }

  /** Scoping the lookup by event stops one org editing another's types. */
  private async findInEvent(eventId: string, ticketTypeId: string) {
    const found = await this.prisma.ticketType.findFirst({
      where: { id: ticketTypeId, eventId },
      select: {
        id: true,
        sold: true,
        priceMinor: true,
        salesStart: true,
        salesEnd: true,
        event: { select: { organizationId: true } },
      },
    });
    if (!found) throw new NotFoundException('Ticket type not found');
    return found;
  }

  private assertSaleWindow(start?: string, end?: string) {
    if (start && end && new Date(end) <= new Date(start)) {
      throw new BadRequestException('Sales end must be after sales start');
    }
  }
}
