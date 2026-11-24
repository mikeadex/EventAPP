import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateOrderSchema, type CreateOrderInput } from '@ekklesia/shared';
import type { Prisma } from '@prisma/client';
import { randomId } from '../../common/random-id.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { ConnectService } from './connect.service.js';

/**
 * How long a PENDING order holds its inventory.
 *
 * Derived from `Order.createdAt` rather than stored, so this needs no
 * migration. Anything longer and an abandoned checkout keeps a sold-out
 * event sold out; anything shorter and a slow 3-D Secure challenge loses the
 * seats mid-authentication.
 */
export const RESERVATION_WINDOW_MS = 15 * 60 * 1000;

/**
 * Platform fee, in basis points, added ON TOP of the ticket price.
 *
 * Two numbers are in play and they disagree, so this is worth stating:
 * `apps/api/.env` already carries `PLATFORM_FEE_BPS=500` (5%), while the
 * design pack's checkout screen shows 3% (£90.00 + £2.70 = £92.70). The
 * default here follows the design; the environment wins where it is set, so
 * today a buyer is charged 5%. Settle which is intended before launch —
 * whichever it is, the Play listing's "no booking fee" copy is wrong.
 *
 * Configurable because it is a commercial decision, not a technical one, and
 * zero is a legitimate value.
 */
function platformFeeBps(): number {
  const raw = process.env.PLATFORM_FEE_BPS;
  if (raw === undefined) return 300;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 10_000) {
    throw new Error(`PLATFORM_FEE_BPS must be an integer between 0 and 10000 (got "${raw}").`);
  }
  return n;
}

/** Ticket code generator, matching the free-RSVP path. */
function makeTicketCode(): string {
  return `EK-${randomId(12).toUpperCase()}`;
}

export interface OrderQuote {
  orderId: string;
  subtotalMinor: number;
  platformFeeMinor: number;
  totalMinor: number;
  currency: string;
  expiresAt: Date;
  items: { ticketTypeId: string; name: string; quantity: number; unitPriceMinor: number }[];
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly connect: ConnectService,
  ) {}

  /**
   * Reserve tickets and open a PENDING order.
   *
   * Prices come from the database, never from the request. The client sends
   * quantities; sending an amount would be sending a price it chose.
   *
   * Inventory is taken here, before payment, because the alternative — taking
   * it on payment success — sells the same seat to everyone who reaches the
   * card form. Reservations expire (see RESERVATION_WINDOW_MS) and are swept
   * by `releaseExpired`.
   */
  async create(userId: string, body: unknown): Promise<OrderQuote> {
    const input: CreateOrderInput = CreateOrderSchema.parse(body);

    // Collapse duplicate line items before counting, or "2 + 3 of the same
    // type" passes a perOrderMax of 4 as two separate 2s and 3s.
    const wanted = new Map<string, number>();
    for (const item of input.items) {
      wanted.set(item.ticketTypeId, (wanted.get(item.ticketTypeId) ?? 0) + item.quantity);
    }

    const feeBps = platformFeeBps();

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: input.eventId },
        select: {
          id: true,
          organizationId: true,
          status: true,
          endsAt: true,
          capacity: true,
          attendeeCount: true,
        },
      });
      if (!event) throw new NotFoundException('Event not found');
      if (event.status !== 'PUBLISHED') {
        throw new ForbiddenException('Event is not open for sale');
      }
      if (event.endsAt <= new Date()) {
        throw new ForbiddenException('Event has ended');
      }

      // Refuse before holding anything. An organisation that cannot receive
      // payouts cannot sell paid tickets: the alternative is taking money we
      // have no way to forward, which turns a host's unfinished onboarding
      // into our liability and the buyer's problem. Free events are not
      // affected — RSVP never touches Stripe.
      const destination = await this.connect.payableAccountFor(event.organizationId);
      if (!destination) {
        throw new ForbiddenException(
          'This host has not finished setting up payouts, so tickets cannot be sold yet.',
        );
      }

      const types = await tx.ticketType.findMany({
        where: { id: { in: [...wanted.keys()] }, eventId: event.id },
        select: {
          id: true,
          name: true,
          priceMinor: true,
          currency: true,
          quantity: true,
          sold: true,
          perOrderMax: true,
          salesStart: true,
          salesEnd: true,
        },
      });
      if (types.length !== wanted.size) {
        // Either an unknown id, or one belonging to a different event. Not
        // distinguished on purpose: both are "not for sale here", and saying
        // which would confirm the existence of another event's ticket type.
        throw new NotFoundException('One or more ticket types are not available for this event');
      }

      const now = new Date();
      let subtotalMinor = 0;
      const currencies = new Set<string>();
      const lineItems: OrderQuote['items'] = [];

      for (const t of types) {
        const qty = wanted.get(t.id)!;
        if (t.salesStart && t.salesStart > now) {
          throw new ForbiddenException(`Sales for "${t.name}" have not opened yet`);
        }
        if (t.salesEnd && t.salesEnd <= now) {
          throw new ForbiddenException(`Sales for "${t.name}" have closed`);
        }
        if (qty > t.perOrderMax) {
          throw new BadRequestException(
            `At most ${t.perOrderMax} of "${t.name}" per order (asked for ${qty})`,
          );
        }
        // A free type has no business in a paid order: it would create a
        // zero-amount PaymentIntent, which Stripe rejects.
        if (t.priceMinor <= 0) {
          throw new BadRequestException(`"${t.name}" is free — use RSVP rather than checkout`);
        }
        currencies.add(t.currency);
        subtotalMinor += t.priceMinor * qty;
        lineItems.push({
          ticketTypeId: t.id,
          name: t.name,
          quantity: qty,
          unitPriceMinor: t.priceMinor,
        });
      }

      if (currencies.size > 1) {
        // One PaymentIntent carries one currency. Mixed-currency types on one
        // event is a configuration mistake, but it must not become a charge
        // in whichever currency happened to sort first.
        throw new BadRequestException(
          'This order mixes currencies. Buy each currency’s tickets separately.',
        );
      }
      const currency = [...currencies][0]!;

      // Reserve each type atomically. The conditional `updateMany` is the
      // whole guard: if another order took the last seat between the read
      // above and this write, zero rows match and nothing is oversold.
      for (const line of lineItems) {
        const t = types.find((x) => x.id === line.ticketTypeId)!;
        const reserved = await tx.ticketType.updateMany({
          where: {
            id: line.ticketTypeId,
            sold: { lte: t.quantity - line.quantity },
          },
          data: { sold: { increment: line.quantity } },
        });
        if (reserved.count === 0) {
          throw new ConflictException(`"${line.name}" is sold out`);
        }
      }

      const totalQty = lineItems.reduce((n, l) => n + l.quantity, 0);
      if (event.capacity !== null) {
        const held = await tx.event.updateMany({
          where: { id: event.id, attendeeCount: { lte: event.capacity - totalQty } },
          data: { attendeeCount: { increment: totalQty } },
        });
        if (held.count === 0) throw new ConflictException('Event is at capacity');
      } else {
        await tx.event.update({
          where: { id: event.id },
          data: { attendeeCount: { increment: totalQty } },
        });
      }

      // Rounded half-up on the subtotal, not per line: summing rounded line
      // fees drifts from a percentage of the total by a penny or two, and the
      // number shown to the buyer has to be the number charged.
      const platformFeeMinor = Math.round((subtotalMinor * feeBps) / 10_000);
      const totalMinor = subtotalMinor + platformFeeMinor;

      const order = await tx.order.create({
        data: {
          userId,
          eventId: event.id,
          organizationId: event.organizationId,
          subtotalMinor,
          platformFeeMinor,
          totalMinor,
          currency,
          status: 'PENDING',
          items: {
            create: lineItems.map((l) => ({
              ticketTypeId: l.ticketTypeId,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
              currency,
            })),
          },
        },
        select: { id: true, createdAt: true },
      });

      // RESERVED, not ISSUED. These become real tickets only once the payment
      // succeeds; until then they exist to hold the inventory they represent.
      for (const line of lineItems) {
        for (let i = 0; i < line.quantity; i++) {
          await tx.ticket.create({
            data: {
              code: makeTicketCode(),
              eventId: event.id,
              ticketTypeId: line.ticketTypeId,
              orderId: order.id,
              userId,
              attendeeName: input.attendeeName,
              status: 'RESERVED',
            },
          });
        }
      }

      await this.audit.write({
        actorUserId: userId,
        organizationId: event.organizationId,
        action: 'order.created',
        targetType: 'order',
        targetId: order.id,
        metadata: { totalMinor, currency, quantity: totalQty } as Prisma.InputJsonValue,
        tx,
      });

      return {
        orderId: order.id,
        subtotalMinor,
        platformFeeMinor,
        totalMinor,
        currency,
        expiresAt: new Date(order.createdAt.getTime() + RESERVATION_WINDOW_MS),
        items: lineItems,
      };
    });
  }

  /**
   * Hand inventory back from orders that were never paid for.
   *
   * Without this an abandoned checkout holds its seats forever and a popular
   * event reads as sold out while nobody is coming. Safe to call repeatedly
   * and from more than one process: the status guard in `updateMany` means
   * only one caller can move a given order out of PENDING.
   */
  async releaseExpired(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - RESERVATION_WINDOW_MS);
    const stale = await this.prisma.order.findMany({
      where: { status: 'PENDING', createdAt: { lt: cutoff } },
      select: {
        id: true,
        eventId: true,
        items: { select: { ticketTypeId: true, quantity: true } },
      },
      take: 200,
    });

    let released = 0;
    for (const order of stale) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // Claim it first. If another sweeper (or a late payment) already
          // moved it, count is 0 and we must not give the seats back twice.
          const claimed = await tx.order.updateMany({
            where: { id: order.id, status: 'PENDING' },
            data: { status: 'EXPIRED' },
          });
          if (claimed.count === 0) return;

          for (const item of order.items) {
            await tx.ticketType.update({
              where: { id: item.ticketTypeId },
              data: { sold: { decrement: item.quantity } },
            });
          }
          const total = order.items.reduce((n, i) => n + i.quantity, 0);
          await tx.event.update({
            where: { id: order.eventId },
            data: { attendeeCount: { decrement: total } },
          });
          await tx.ticket.updateMany({
            where: { orderId: order.id, status: 'RESERVED' },
            data: { status: 'EXPIRED' },
          });
          released += 1;
        });
      } catch (err) {
        this.logger.error(`Failed to release order ${order.id}: ${(err as Error).message}`);
      }
    }
    if (released > 0) this.logger.log(`Released ${released} expired order(s)`);
    return released;
  }

  async getForUser(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      select: {
        id: true,
        status: true,
        subtotalMinor: true,
        platformFeeMinor: true,
        totalMinor: true,
        currency: true,
        createdAt: true,
        event: { select: { id: true, title: true, startsAt: true } },
        items: {
          select: {
            quantity: true,
            unitPriceMinor: true,
            ticketType: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return {
      ...order,
      expiresAt: new Date(order.createdAt.getTime() + RESERVATION_WINDOW_MS),
    };
  }
}
