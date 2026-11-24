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
  /** Better Auth's own hash, so the password signs in with `signIn.email`. */
  abstract hashPassword(password: string): Promise<string>;
}

/** An unverified account being taken over by the claim; see claimWithPassword. */
type Takeover = { name: string; passwordHash: string };

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
    // An unverified sign-up can't sign in, so it is not an account to use here.
    return {
      organization: { name: organization.name, slug: organization.slug, kind: organization.kind },
      email: token.email.toLowerCase(),
      events: events.map((e) => ({ title: e.title, startsAt: e.startsAt })),
      hasAccount: !!existing?.emailVerified,
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

    // A verified account — or any staff account — signs in and attaches.
    const existing = await this.findUserByEmail(email);
    if (existing && (existing.emailVerified || existing.platformRole !== 'USER')) {
      throw new ConflictException({ code: 'SIGN_IN' });
    }
    if (existing) {
      // Someone signed up with this address but never confirmed it — possibly
      // not its owner, and it would otherwise block the claim forever (they
      // cannot sign in either). Following the emailed claim link proves
      // control of the address, so the claim takes that account over.
      const passwordHash = await this.accounts.hashPassword(input.password);
      await this.complete(raw, organization.id, existing.id, 'password', req, {
        name: input.name,
        passwordHash,
      });
      return { email };
    }

    let user: { id: string };
    try {
      user = await this.accounts.createPasswordUser({
        email,
        name: input.name,
        password: input.password,
      });
    } catch (err) {
      // Someone made this account between the check above and now; a retry
      // takes the path above.
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
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerified: true, platformRole: true },
    });
    if (!account?.emailVerified) throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED' });
    // Staff accounts are for the console, not for owning a church.
    if (account.platformRole !== 'USER') throw new ForbiddenException({ code: 'STAFF_ACCOUNT' });
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
    takeover?: Takeover,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await this.leaveUnclaimed(tx, organizationId, { claimStatus: 'CLAIMED', claimedAt: now });
      await this.consume(tx, raw, 'CLAIM');
      if (takeover) await this.takeOver(tx, userId, takeover);
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
        metadata: takeover ? { via, takeover: 'unverified-account' } : { via },
        req,
        tx,
      });
    });
  }

  /**
   * Make an unverified account the claimer's: verified, their name, their
   * password as its only sign-in, and every earlier session ended.
   */
  private async takeOver(tx: Prisma.TransactionClient, userId: string, t: Takeover) {
    // Conditional, so an account verified since we looked is not taken.
    const { count } = await tx.user.updateMany({
      where: { id: userId, emailVerified: false },
      data: { emailVerified: true, name: t.name },
    });
    if (count === 0) throw new ConflictException({ code: 'SIGN_IN' });
    await tx.session.deleteMany({ where: { userId } });
    // An unverified account has nothing worth keeping here: drop whatever
    // sign-in methods it had and leave just the claimer's password.
    await tx.account.deleteMany({ where: { userId } });
    await tx.account.create({
      data: { userId, providerId: 'credential', accountId: userId, password: t.passwordHash },
    });
    // Nothing of the previous holder's may carry over: their push tokens
    // would receive the claimer's notices, and the rest is their choices,
    // not the claimer's. Profile is only ever read by the API, so absent is
    // its normal state for a new account.
    await tx.device.deleteMany({ where: { userId } });
    await tx.savedEvent.deleteMany({ where: { userId } });
    await tx.consent.deleteMany({ where: { userId } });
    await tx.notificationPreference.deleteMany({ where: { userId } });
    await tx.profile.deleteMany({ where: { userId } });
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
    const failedEventIds: string[] = [];
    for (const { id } of events) {
      try {
        await this.events.cancel(id, null, TAKEDOWN_CANCEL_REASON);
        cancelledEvents++;
      } catch (err) {
        failedEventIds.push(id);
        this.logger.error(
          `Take-down of ${organizationId}: could not cancel event ${id}: ${(err as Error).message}`,
        );
      }
    }
    if (failedEventIds.length) {
      // So staff can find and unpublish the stragglers.
      await this.audit.write({
        organizationId,
        action: 'host.disputed.cancel_failed',
        targetType: 'organization',
        targetId: organizationId,
        metadata: { failedEventIds },
        req,
      });
    }
    return { cancelledEvents };
  }

  // ─── Invite (staff) ──────────────────────────────────────────────────────

  /**
   * Email the church's contact a claim link and a take-down link. Each send
   * issues both: a resend voids earlier claim links, while earlier take-down
   * links keep working until the church is claimed or taken down.
   *
   * A failed send does not throw: the links stay issued (the next resend
   * voids the claim link anyway) and `sent` says whether it went.
   */
  async sendInvite(organizationId: string, actorUserId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.claimStatus !== 'UNCLAIMED') throw new ConflictException({ code: 'NOT_UNCLAIMED' });
    const email = org.contactEmail?.trim().toLowerCase();
    if (!email) throw new ConflictException({ code: 'NO_CONTACT_EMAIL' });

    const issued = await this.prisma.$transaction(async (tx) => {
      const issue = (kind: 'CLAIM' | 'TAKEDOWN') =>
        this.tokens.issue(tx, { organizationId, email, kind, createdByUserId: actorUserId });
      return { claim: await issue('CLAIM'), takedown: await issue('TAKEDOWN') };
    });

    const hasAccount = !!(await this.findUserByEmail(email))?.emailVerified;
    const web = webUrl();
    const data = {
      orgName: org.name,
      contactName: org.contactName,
      claimUrl: `${web}/claim/${issued.claim}`,
      takedownUrl: `${web}/takedown/${issued.takedown}`,
      expiresInLabel: '7 days',
    };

    // Without a mail provider nobody can follow these links locally. The URLs
    // carry tokens that grant the action, so never in production.
    if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        `[dev-only, email not configured] claim links for ${org.name}: ` +
          `claim ${data.claimUrl} | take-down ${data.takedownUrl}`,
      );
    }

    const { subject, html, text } = hasAccount ? claimAddedEmail(data) : claimInviteEmail(data);
    let sent = true;
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
      sent = false;
      this.logger.error(
        `Claim email for ${organizationId} was not sent: ${(err as Error).message}`,
      );
    }
    return { sent, email, hasAccount };
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
      select: { id: true, emailVerified: true, platformRole: true },
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
