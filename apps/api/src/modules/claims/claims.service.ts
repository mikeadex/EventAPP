import {
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Organization, OrganizationClaimToken, Prisma } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditLogService } from '../../common/audit-log.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthedUser } from '../auth/current-user.service.js';
import { EmailService } from '../email/email.service.js';
import { claimAddedEmail } from '../email/templates/claim-added.js';
import { claimInviteEmail } from '../email/templates/claim-invite.js';
import { EventsService } from '../events/events.service.js';
import { ClaimTokensService, hashToken, type ClaimTokenError } from './claim-tokens.service.js';

/** The cancellation reason bookers see when a church takes its page down. */
export const TAKEDOWN_CANCEL_REASON = "Removed at the church's request";

/** Matches `emailAndPassword` in auth.ts. */
const PasswordClaimSchema = z.object({
  name: z.string().trim().min(1).max(120),
  password: z.string().min(12).max(128),
});

const TakedownSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

/**
 * The Better Auth operations a password claim needs, behind a seam so the
 * claim flow can be tested without Better Auth. See better-auth-claim-accounts.ts.
 */
export abstract class ClaimAccounts {
  /** A verified user with a credential (email + password) account. */
  abstract createPasswordUser(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ id: string }>;
  /** Undo `createPasswordUser` when the claim it was made for is refused. */
  abstract deleteUser(id: string): Promise<void>;
}

type Valid = { token: OrganizationClaimToken; organization: Organization };

const gone = (code: ClaimTokenError) => new GoneException({ code });

/**
 * Lets a church's contact claim, or take down, a page that staff added.
 *
 * Both actions move the organization out of UNCLAIMED, and each does so with
 * a conditional update (`WHERE claimStatus = 'UNCLAIMED'`) as the first write
 * of its transaction. That row is the lock: two claims, or a claim and a
 * take-down, cannot both win, and taking it first in both paths keeps them
 * from deadlocking on each other's tokens.
 */
@Injectable()
export class ClaimsService {
  private readonly logger = new Logger(ClaimsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: ClaimTokensService,
    private readonly audit: AuditLogService,
    private readonly email: EmailService,
    private readonly events: EventsService,
    private readonly accounts: ClaimAccounts,
  ) {}

  // ─── Claim ───────────────────────────────────────────────────────────────

  async getClaim(raw: string) {
    const { token, organization } = await this.valid(raw, 'CLAIM');
    const [events, existing] = await Promise.all([
      this.prisma.event.findMany({
        where: { organizationId: organization.id, status: 'PUBLISHED', deletedAt: null },
        select: { title: true, startsAt: true },
        orderBy: { startsAt: 'asc' },
        take: 50,
      }),
      this.findUserByEmail(token.email),
    ]);
    return {
      organization: { name: organization.name, slug: organization.slug, kind: organization.kind },
      email: token.email.toLowerCase(),
      events: events.map((e) => ({ title: e.title, startsAt: e.startsAt })),
      hasAccount: !!existing,
    };
  }

  /**
   * Claim with a new account. The web signs in with `signIn.email` afterwards;
   * no session is made here.
   */
  async claimWithPassword(raw: string, body: unknown, req: Request | undefined) {
    const input = PasswordClaimSchema.parse(body);
    const { token, organization } = await this.valid(raw, 'CLAIM');
    const email = token.email.toLowerCase();

    // Any existing account — staff included — signs in and attaches instead.
    if (await this.findUserByEmail(email)) throw new ConflictException({ code: 'SIGN_IN' });

    let user: { id: string };
    try {
      user = await this.accounts.createPasswordUser({
        email,
        name: input.name,
        password: input.password,
      });
    } catch (err) {
      // Someone made this account between the check above and now.
      if (await this.findUserByEmail(email)) throw new ConflictException({ code: 'SIGN_IN' });
      throw err;
    }

    try {
      await this.complete(raw, organization.id, user.id, 'password', req);
    } catch (err) {
      // Better Auth writes through its own client, so the account cannot share
      // the claim's transaction; remove it rather than leave an account that
      // claimed nothing.
      await this.accounts
        .deleteUser(user.id)
        .catch((cleanup: Error) =>
          this.logger.error(
            `Could not remove account ${user.id} after a refused claim: ${cleanup.message}`,
          ),
        );
      throw err;
    }
    return { email };
  }

  /** Claim for the signed-in account, whose address must be the one invited. */
  async attach(raw: string, user: AuthedUser, req: Request | undefined) {
    const { token, organization } = await this.valid(raw, 'CLAIM');
    if (user.email.toLowerCase() !== token.email.toLowerCase()) {
      throw new ForbiddenException({ code: 'EMAIL_MISMATCH' });
    }
    await this.complete(raw, organization.id, user.id, 'attach', req);
    return {
      organization: { id: organization.id, slug: organization.slug, name: organization.name },
    };
  }

  private async complete(
    raw: string,
    organizationId: string,
    userId: string,
    via: 'password' | 'attach',
    req: Request | undefined,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.leaveUnclaimed(tx, organizationId, { claimStatus: 'CLAIMED', claimedAt: now });
      await this.consume(tx, raw, 'CLAIM');
      await tx.organizationMembership.upsert({
        where: { userId_organizationId: { userId, organizationId } },
        create: { userId, organizationId, role: 'OWNER', acceptedAt: now },
        update: { role: 'OWNER', acceptedAt: now },
      });
      // From now on the owner controls the page.
      await tx.organizationClaimToken.updateMany({
        where: { organizationId, kind: 'TAKEDOWN', usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.write({
        actorUserId: userId,
        organizationId,
        action: 'host.claim',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { via },
        req,
        tx,
      });
    });
  }

  // ─── Take down ───────────────────────────────────────────────────────────

  async getTakedown(raw: string) {
    const { organization } = await this.valid(raw, 'TAKEDOWN');
    return { organization: { name: organization.name } };
  }

  async takedown(raw: string, body: unknown, req: Request | undefined) {
    const input = TakedownSchema.parse(body ?? {});
    const reason = input.reason || undefined;
    const { organization } = await this.valid(raw, 'TAKEDOWN');
    const organizationId = organization.id;

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.leaveUnclaimed(tx, organizationId, { claimStatus: 'DISPUTED' });
      await this.consume(tx, raw, 'TAKEDOWN');
      await tx.organizationClaimToken.updateMany({
        where: { organizationId, kind: 'CLAIM', usedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
      await this.audit.write({
        organizationId,
        action: 'host.disputed',
        targetType: 'organization',
        targetId: organizationId,
        metadata: reason ? { reason } : {},
        req,
        tx,
      });
    });

    // After the commit: the page is already hidden (DISPUTED), and cancel()
    // writes through its own client and notifies bookers. One event failing
    // must not stop the rest; a straggler stays visible by direct link only
    // and staff can unpublish it from the console.
    const events = await this.prisma.event.findMany({
      where: { organizationId, status: 'PUBLISHED', deletedAt: null },
      select: { id: true },
      orderBy: { startsAt: 'asc' },
    });
    let cancelledEvents = 0;
    for (const { id } of events) {
      try {
        await this.events.cancel(id, null, TAKEDOWN_CANCEL_REASON);
        cancelledEvents++;
      } catch (err) {
        this.logger.error(
          `Take-down of ${organizationId}: could not cancel event ${id}: ${(err as Error).message}`,
        );
      }
    }
    return { cancelledEvents };
  }

  // ─── Invite (staff) ──────────────────────────────────────────────────────

  /**
   * Email the church's contact a claim link, and — the first time only — a
   * take-down link. A resend voids the previous claim link; the take-down
   * link from the first email keeps working.
   */
  async sendInvite(organizationId: string, actorUserId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.claimStatus !== 'UNCLAIMED') throw new ConflictException('NOT_UNCLAIMED');
    const email = org.contactEmail?.trim().toLowerCase();
    if (!email) throw new ConflictException('NO_CONTACT_EMAIL');

    const issued = await this.prisma.$transaction(async (tx) => {
      const claim = await this.tokens.issue(tx, {
        organizationId,
        email,
        kind: 'CLAIM',
        createdByUserId: actorUserId,
      });
      const hasTakedown = await tx.organizationClaimToken.findFirst({
        where: { organizationId, kind: 'TAKEDOWN' },
      });
      const takedown = hasTakedown
        ? null
        : await this.tokens.issue(tx, {
            organizationId,
            email,
            kind: 'TAKEDOWN',
            createdByUserId: actorUserId,
          });
      return { claim, takedown };
    });

    const hasAccount = !!(await this.findUserByEmail(email));
    const web = webUrl();
    const data = {
      orgName: org.name,
      contactName: org.contactName,
      claimUrl: `${web}/claim/${issued.claim}`,
      takedownUrl: issued.takedown ? `${web}/takedown/${issued.takedown}` : null,
      expiresInLabel: '7 days',
    };
    const { subject, html, text } = hasAccount ? claimAddedEmail(data) : claimInviteEmail(data);

    try {
      await this.email.send({
        to: email,
        subject,
        html,
        text,
        tags: [{ name: 'type', value: hasAccount ? 'claim-added' : 'claim-invite' }],
        required: true,
      });
    } catch (err) {
      // Nobody received these links. Void the claim link, and remove a
      // take-down link outright so the next send can issue one; otherwise it
      // would exist forever with no one able to use it.
      await this.prisma.organizationClaimToken.updateMany({
        where: { tokenHash: hashToken(issued.claim), revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (issued.takedown) {
        await this.prisma.organizationClaimToken.deleteMany({
          where: { tokenHash: hashToken(issued.takedown) },
        });
      }
      throw err;
    }
    return { email, hasAccount };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /** Peek, answering 410 `{ code }` for a link that cannot be used. */
  private async valid(raw: string, kind: 'CLAIM' | 'TAKEDOWN'): Promise<Valid> {
    const res = await this.tokens.peek(raw, kind);
    if (!('error' in res)) return res;
    // A link spent by the claim itself (or revoked by it) reads USED; say
    // "already claimed" instead so the page can tell them so.
    if (res.error === 'USED') {
      const row = await this.prisma.organizationClaimToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        include: { organization: { select: { claimStatus: true } } },
      });
      if (row?.organization.claimStatus === 'CLAIMED') throw gone('CLAIMED');
    }
    throw gone(res.error);
  }

  /**
   * Move the organization out of UNCLAIMED, or answer 410 if something else
   * already did: CLAIMED if it was claimed, USED if it was taken down.
   */
  private async leaveUnclaimed(
    tx: Prisma.TransactionClient,
    id: string,
    data: Prisma.OrganizationUpdateManyMutationInput,
  ) {
    const { count } = await tx.organization.updateMany({
      where: { id, claimStatus: 'UNCLAIMED' },
      data,
    });
    if (count === 0) {
      const now = await tx.organization.findUnique({
        where: { id },
        select: { claimStatus: true },
      });
      throw gone(now?.claimStatus === 'CLAIMED' ? 'CLAIMED' : 'USED');
    }
  }

  /** ClaimTokensService.consume, with its refusal turned into 410 `{ code }`. */
  private async consume(tx: Prisma.TransactionClient, raw: string, kind: 'CLAIM' | 'TAKEDOWN') {
    try {
      return await this.tokens.consume(tx, raw, kind);
    } catch (err) {
      if (err instanceof GoneException) {
        const message = (err.getResponse() as { message?: string }).message;
        throw gone((message as ClaimTokenError | undefined) ?? 'INVALID');
      }
      throw err;
    }
  }

  /** Better Auth stores addresses lowercased; older rows may not be. */
  private findUserByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true },
    });
  }
}

/** Where emailed links point. Same fallback as the ticket and moderation mail. */
function webUrl(): string {
  const url = process.env.WEB_URL;
  if (!url) {
    console.warn('[claims] WEB_URL is not set — claim links will point at http://localhost:3000');
    return 'http://localhost:3000';
  }
  return url.replace(/\/+$/, '');
}
