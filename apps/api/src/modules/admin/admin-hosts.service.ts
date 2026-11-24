import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminContactSchema,
  AdminCreateHostSchema,
  AdminRestoreSchema,
  CreateEventSchema,
  CURRENCY_FOR_COUNTRY,
  OrgKind,
  slugify,
  type CreateEventInput,
} from '@ekklesia/shared';
import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditLogService } from '../../common/audit-log.service.js';
import { randomId } from '../../common/random-id.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClaimsService } from '../claims/claims.service.js';
import { EventsService } from '../events/events.service.js';

const ListHostsSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(['all', 'unclaimed', 'claimed', 'disputed']).default('all'),
  kind: OrgKind.optional(),
});

const MatchSchema = z.object({
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().max(254).optional(),
});

/**
 * Top-level web paths a church slug must not take, or its page at
 * `/<slug>` would be unreachable behind them.
 */
const RESERVED_SLUGS = new Set([
  'account',
  'admin',
  'api',
  'claim',
  'delete-account',
  'events',
  'for-churches',
  'me',
  'organizer',
  'privacy',
  'reset-password',
  'saved',
  'sign-in',
  'sign-up',
  'support',
  'takedown',
  'terms',
]);

/** A church in the list: enough to pick it out and see where it stands. */
const HOST_ROW_SELECT = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  city: true,
  claimStatus: true,
  verificationStatus: true,
  contactEmail: true,
  createdAt: true,
} satisfies Prisma.OrganizationSelect;

const notUnclaimed = () => new ConflictException({ code: 'NOT_UNCLAIMED' });

/**
 * Staff adding a church on its behalf, and looking after it until it claims
 * the page (or takes it down).
 *
 * A staff-added church belongs to nobody: no memberships, UNCLAIMED,
 * UNVERIFIED. Its contact is emailed a claim link (ClaimsService); until they
 * use it the church can only list free events, because there is no owner or
 * payout account for money to go to.
 */
@Injectable()
export class AdminHostsService {
  private readonly logger = new Logger(AdminHostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly events: EventsService,
    private readonly claims: ClaimsService,
  ) {}

  // ─── Read ────────────────────────────────────────────────────────────────

  async list(query: unknown) {
    const input = ListHostsSchema.parse(query ?? {});
    const q = input.q || undefined;
    const rows = await this.prisma.organization.findMany({
      where: {
        deletedAt: null,
        ...(input.status !== 'all' && {
          claimStatus: input.status.toUpperCase() as 'UNCLAIMED' | 'CLAIMED' | 'DISPUTED',
        }),
        ...(input.kind && {
          kind: input.kind.toUpperCase() as 'CHURCH' | 'MINISTRY' | 'COMMUNITY',
        }),
        ...(q && {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { slug: { contains: q, mode: 'insensitive' as const } },
            { city: { contains: q, mode: 'insensitive' as const } },
            { contactEmail: { contains: q, mode: 'insensitive' as const } },
          ],
        }),
      },
      select: {
        ...HOST_ROW_SELECT,
        _count: {
          select: {
            events: {
              where: { status: 'PUBLISHED', deletedAt: null, endsAt: { gte: new Date() } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      items: rows.map(({ _count, ...row }) => ({ ...row, upcomingCount: _count.events })),
    };
  }

  async get(id: string) {
    const host = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...HOST_ROW_SELECT,
        country: true,
        currency: true,
        claimedAt: true,
        contactName: true,
        addedBy: { select: { id: true, name: true, email: true } },
        events: {
          where: { deletedAt: null },
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
          },
          orderBy: { startsAt: 'desc' },
          take: 100,
        },
      },
    });
    if (!host) throw new NotFoundException('Host not found');
    const lastInvite = await this.prisma.organizationClaimToken.findFirst({
      where: { organizationId: id, kind: 'CLAIM' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return { ...host, lastInviteAt: lastInvite?.createdAt ?? null };
  }

  /**
   * Churches that might already be the one being added: the same contact
   * address (any case), or a name containing the one typed.
   */
  async match(query: unknown) {
    const input = MatchSchema.parse(query ?? {});
    const or: Prisma.OrganizationWhereInput[] = [];
    if (input.email) or.push({ contactEmail: { equals: input.email, mode: 'insensitive' } });
    if (input.name && input.name.length >= 2) {
      or.push({ name: { contains: input.name, mode: 'insensitive' } });
    }
    if (!or.length) return { items: [] };
    const items = await this.prisma.organization.findMany({
      where: { deletedAt: null, OR: or },
      select: { id: true, name: true, slug: true, claimStatus: true },
      orderBy: { name: 'asc' },
      take: 10,
    });
    return { items };
  }

  // ─── Add ─────────────────────────────────────────────────────────────────

  /**
   * A new church and its first event, published, then the claim email.
   *
   * EventsService runs its own transaction, so the church cannot share one
   * with the event. If the event cannot be created or published, the church
   * (and any draft) is soft-deleted and the error rethrown. The email going
   * astray undoes nothing: `inviteSent` says so and staff can resend.
   */
  async create(staffId: string, body: unknown, req: Request | undefined) {
    const { church, event: eventInput } = AdminCreateHostSchema.parse(body);
    assertFreeOnly(eventInput);

    const org = await this.prisma.$transaction(async (tx) => {
      const slug = await this.allocateSlug(tx, church.name, church.city);
      const created = await tx.organization.create({
        data: {
          slug,
          name: church.name,
          kind: church.kind.toUpperCase() as 'CHURCH' | 'MINISTRY' | 'COMMUNITY',
          country: church.country,
          currency: CURRENCY_FOR_COUNTRY[church.country],
          city: church.city,
          contactName: church.contactName,
          contactEmail: church.contactEmail,
          claimStatus: 'UNCLAIMED',
          verificationStatus: 'UNVERIFIED',
          addedByUserId: staffId,
        },
        select: { id: true, slug: true },
      });
      await this.audit.write({
        actorUserId: staffId,
        organizationId: created.id,
        action: 'admin.host.create',
        targetType: 'organization',
        targetId: created.id,
        metadata: { name: church.name },
        req,
        tx,
      });
      return created;
    });

    let event: { id: string; slug: string };
    try {
      event = await this.createAndPublish(org.id, staffId, eventInput, req);
    } catch (err) {
      await this.prisma.organization
        .update({ where: { id: org.id }, data: { deletedAt: new Date() } })
        .catch((cleanup: Error) =>
          this.logger.error(
            `Could not remove church ${org.id} after its event failed: ${cleanup.message}`,
          ),
        );
      throw err;
    }

    const inviteSent = await this.invite(org.id, staffId);
    return { host: org, event, inviteSent };
  }

  /** Another event for a church that has not claimed its page yet. */
  async addEvent(organizationId: string, staffId: string, body: unknown, req: Request | undefined) {
    const input = CreateEventSchema.parse(body);
    const org = await this.findHost(organizationId);
    if (org.claimStatus !== 'UNCLAIMED') throw notUnclaimed();
    assertFreeOnly(input);
    const event = await this.createAndPublish(organizationId, staffId, input, req);
    return { event };
  }

  // ─── Claim email and contact ─────────────────────────────────────────────

  async resend(organizationId: string, staffId: string, req: Request | undefined) {
    await this.findHost(organizationId);
    return { inviteSent: await this.resendInvite(organizationId, staffId, req) };
  }

  /** New contact for an unclaimed church, who is then sent a fresh claim email. */
  async changeContact(
    organizationId: string,
    staffId: string,
    body: unknown,
    req: Request | undefined,
  ) {
    const input = AdminContactSchema.parse(body);
    const org = await this.findHost(organizationId);
    if (org.claimStatus !== 'UNCLAIMED') throw notUnclaimed();

    await this.prisma.$transaction(async (tx) => {
      // Conditional, so a claim landing meanwhile is not redirected.
      const { count } = await tx.organization.updateMany({
        where: { id: organizationId, claimStatus: 'UNCLAIMED', deletedAt: null },
        data: {
          contactEmail: input.contactEmail,
          ...(input.contactName !== undefined && { contactName: input.contactName }),
        },
      });
      if (count === 0) throw notUnclaimed();
      // Both addresses: pointing a claim at a new address hands over the
      // page, so the audit must show where it went.
      await this.audit.write({
        actorUserId: staffId,
        organizationId,
        action: 'admin.host.contact',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { from: org.contactEmail, to: input.contactEmail },
        req,
        tx,
      });
    });

    // Voids the claim link sent to the old address.
    return { inviteSent: await this.resendInvite(organizationId, staffId, req) };
  }

  /**
   * Put a taken-down church back as unclaimed. Its cancelled events stay
   * cancelled; staff re-add any that should run. A new claim email goes only
   * if staff ask for one.
   */
  async restore(organizationId: string, staffId: string, body: unknown, req: Request | undefined) {
    const input = AdminRestoreSchema.parse(body ?? {});
    await this.findHost(organizationId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.organization.updateMany({
        where: { id: organizationId, claimStatus: 'DISPUTED', deletedAt: null },
        data: { claimStatus: 'UNCLAIMED' },
      });
      if (count === 0) throw new ConflictException({ code: 'NOT_DISPUTED' });
      await this.audit.write({
        actorUserId: staffId,
        organizationId,
        action: 'admin.host.restore',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { sendInvite: input.sendInvite },
        req,
        tx,
      });
    });

    const inviteSent = input.sendInvite
      ? await this.resendInvite(organizationId, staffId, req)
      : null;
    return { claimStatus: 'UNCLAIMED' as const, inviteSent };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async findHost(id: string) {
    const org = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, claimStatus: true, contactEmail: true },
    });
    if (!org) throw new NotFoundException('Host not found');
    return org;
  }

  /**
   * Create and publish through EventsService, as a host would. A draft left
   * by a failed publish is soft-deleted: nobody owns this church to finish it.
   */
  private async createAndPublish(
    organizationId: string,
    staffId: string,
    input: CreateEventInput,
    req: Request | undefined,
  ) {
    const created = await this.events.create(organizationId, staffId, input);
    try {
      await this.events.publish(created.id, staffId);
    } catch (err) {
      await this.prisma.event
        .update({ where: { id: created.id }, data: { deletedAt: new Date() } })
        .catch((cleanup: Error) =>
          this.logger.error(
            `Could not remove draft ${created.id} after its publish failed: ${cleanup.message}`,
          ),
        );
      throw err;
    }
    await this.audit.write({
      actorUserId: staffId,
      organizationId,
      action: 'admin.event.create',
      targetType: 'event',
      targetId: created.id,
      metadata: { title: input.title },
      req,
    });
    return { id: created.id, slug: created.slug };
  }

  /** The first claim email. Never fails the church it is for. */
  private async invite(organizationId: string, staffId: string): Promise<boolean> {
    try {
      return (await this.claims.sendInvite(organizationId, staffId)).sent;
    } catch (err) {
      this.logger.error(`Claim invite for ${organizationId} failed: ${(err as Error).message}`);
      return false;
    }
  }

  /** A fresh claim email; NOT_UNCLAIMED / NO_CONTACT_EMAIL pass through as 409. */
  private async resendInvite(organizationId: string, staffId: string, req: Request | undefined) {
    const { sent } = await this.claims.sendInvite(organizationId, staffId);
    await this.audit.write({
      actorUserId: staffId,
      organizationId,
      action: 'admin.claim.resend',
      targetType: 'organization',
      targetId: organizationId,
      metadata: { sent },
      req,
    });
    return sent;
  }

  /**
   * The church's name as a slug; then with its city; then with a random
   * suffix. Host sign-up has people pick their own slug, so there is nothing
   * of its to reuse here.
   */
  private async allocateSlug(tx: Prisma.TransactionClient, name: string, city: string) {
    const fromName = slugify(name, 50);
    const root = fromName.length >= 3 ? fromName : 'church';
    const fromCity = slugify(city, 20);
    const candidates = [root, `${root}-${fromCity}`];
    for (let i = 0; i < 5; i++) candidates.push(`${root}-${randomId(5).toLowerCase()}`);

    for (const slug of candidates) {
      if (RESERVED_SLUGS.has(slug)) continue;
      const clash = await tx.organization.findUnique({ where: { slug }, select: { id: true } });
      if (!clash) return slug;
    }
    return `${root}-${randomId(10).toLowerCase()}`;
  }
}

/** Unclaimed churches list free events only: no owner, no payout account. */
function assertFreeOnly(input: CreateEventInput) {
  if (input.ticketTypes.some((t) => t.priceMinor > 0)) {
    throw new BadRequestException({ code: 'FREE_ONLY' });
  }
}
