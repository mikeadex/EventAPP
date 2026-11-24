import type { ExecutionContext } from '@nestjs/common';
import { HttpException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../../common/audit-log.service.js';
import { PlatformRoleGuard } from '../../common/platform-role.guard.js';
import { AdminEventsService } from './admin-events.service.js';
import { AdminHostsService } from './admin-hosts.service.js';
import { ClaimTokensService } from '../claims/claim-tokens.service.js';
import { AdminController } from './admin.module.js';

// Importing AdminController loads auth.ts, which builds an EmailService at
// module load and warns that no mail provider is set. Nothing here sends mail.
jest.mock('../email/email.service.js', () => ({ EmailService: class {} }));

const NOW = new Date('2026-11-24T12:00:00.000Z');
const DAY = 24 * 3600 * 1000;

type ClaimStatus = 'CLAIMED' | 'UNCLAIMED' | 'DISPUTED';
type Org = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  city: string | null;
  country: string;
  currency: string;
  timezone: string;
  claimStatus: ClaimStatus;
  verificationStatus: string;
  contactName: string | null;
  contactEmail: string | null;
  addedByUserId: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};
type Event = {
  id: string;
  slug: string;
  organizationId: string;
  title: string;
  status: string;
  deletedAt: Date | null;
};
type Membership = { userId: string; organizationId: string };
type Audit = {
  actorUserId?: string;
  organizationId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
};
type Token = {
  id: string;
  organizationId: string;
  kind: 'CLAIM' | 'TAKEDOWN';
  email: string;
  tokenHash: string;
  expiresAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
};
type TokenWhere = {
  organizationId?: string;
  kind?: Token['kind'];
  usedAt?: null;
  revokedAt?: null;
};
type State = {
  orgs: Org[];
  events: Event[];
  memberships: Membership[];
  tokens: Token[];
  audits: Audit[];
};

type Insensitive = { equals?: string; contains?: string; mode?: 'insensitive' };
type OrgWhere = {
  id?: string;
  slug?: string;
  claimStatus?: ClaimStatus;
  deletedAt?: null;
  OR?: Array<{ contactEmail?: Insensitive; name?: Insensitive }>;
};

const like = (value: string | null, f: Insensitive) => {
  const v = (value ?? '').toLowerCase();
  if (f.equals !== undefined) return v === f.equals.toLowerCase();
  if (f.contains !== undefined) return v.includes(f.contains.toLowerCase());
  return true;
};
const orgMatches = (o: Org, w: OrgWhere) =>
  (w.id === undefined || o.id === w.id) &&
  (w.slug === undefined || o.slug === w.slug) &&
  (w.claimStatus === undefined || o.claimStatus === w.claimStatus) &&
  (w.deletedAt === undefined || o.deletedAt === null) &&
  (w.OR === undefined ||
    w.OR.some(
      (c) =>
        (c.contactEmail !== undefined && like(o.contactEmail, c.contactEmail)) ||
        (c.name !== undefined && like(o.name, c.name)),
    ));

type Select = Record<string, unknown> | undefined;
/** A copy with just the selected top-level fields, as Prisma returns. */
const pick = <T extends object>(row: T | undefined, select: Select) => {
  if (!row) return null;
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.keys(select).map((k) => [k, (row as Record<string, unknown>)[k]]),
  );
};

/**
 * In-memory stand-in for the Prisma calls the admin host flows make. Like the
 * claims fake, `$transaction` rolls the state back if its callback throws.
 */
function fakeDb(initial: State) {
  let s: State = initial;
  const db = {
    get state() {
      return s;
    },
    organization: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { id?: string; slug?: string };
        select?: Select;
      }) =>
        pick(
          s.orgs.find((o) => orgMatches(o, where)),
          select,
        ),
      findFirst: async ({ where, select }: { where: OrgWhere; select?: Select }) =>
        pick(
          s.orgs.find((o) => orgMatches(o, where)),
          select,
        ),
      findMany: async ({ where, select }: { where: OrgWhere; select?: Select }) =>
        s.orgs.filter((o) => orgMatches(o, where)).map((o) => pick(o, select)),
      create: async ({ data, select }: { data: Partial<Org>; select?: Select }) => {
        if (s.orgs.some((o) => o.slug === data.slug)) throw new Error('P2002 slug');
        const row = {
          id: `org${s.orgs.length + 1}`,
          kind: 'CHURCH',
          city: null,
          timezone: 'Europe/London',
          // The database defaults.
          claimStatus: 'CLAIMED',
          verificationStatus: 'UNVERIFIED',
          contactName: null,
          contactEmail: null,
          addedByUserId: null,
          createdAt: new Date(),
          deletedAt: null,
          ...data,
        } as Org;
        s.orgs.push(row);
        return pick(row, select);
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Org> }) => {
        const o = s.orgs.find((x) => x.id === where.id)!;
        return Object.assign(o, data);
      },
      updateMany: async ({ where, data }: { where: OrgWhere; data: Partial<Org> }) => {
        const hit = s.orgs.filter((o) => orgMatches(o, where));
        hit.forEach((o) => Object.assign(o, data));
        return { count: hit.length };
      },
    },
    event: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; deletedAt: null; status: { not: string } };
      }) => {
        const e = s.events.find(
          (x) => x.id === where.id && x.deletedAt === null && x.status !== where.status.not,
        );
        const o = e && s.orgs.find((x) => x.id === e.organizationId);
        return e && o && o.deletedAt === null ? e : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Event> }) => {
        const e = s.events.find((x) => x.id === where.id)!;
        return Object.assign(e, data);
      },
    },
    organizationMembership: {
      count: async ({ where }: { where: { organizationId: string } }) =>
        s.memberships.filter((m) => m.organizationId === where.organizationId).length,
    },
    organizationClaimToken: {
      create: async ({ data }: { data: Partial<Token> }) => {
        const row = {
          id: `t${s.tokens.length + 1}`,
          expiresAt: null,
          usedAt: null,
          revokedAt: null,
          createdByUserId: null,
          createdAt: new Date(),
          ...data,
        } as Token;
        s.tokens.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const r = s.tokens.find((x) => x.tokenHash === where.tokenHash);
        return r ? { ...r, organization: s.orgs.find((o) => o.id === r.organizationId) } : null;
      },
      updateMany: async ({ where, data }: { where: TokenWhere; data: Partial<Token> }) => {
        const hit = s.tokens.filter(
          (r) =>
            (where.organizationId === undefined || r.organizationId === where.organizationId) &&
            (where.kind === undefined || r.kind === where.kind) &&
            (where.usedAt === undefined || r.usedAt === null) &&
            (where.revokedAt === undefined || r.revokedAt === null),
        );
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
    auditLog: {
      create: async ({ data }: { data: Audit }) => {
        s.audits.push(data);
        return data;
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const snapshot = structuredClone(s);
      try {
        return await fn(db);
      } catch (err) {
        s = snapshot;
        throw err;
      }
    },
  };
  return db;
}

const org = (over: Partial<Org> = {}): Org => ({
  id: 'org1',
  slug: 'grace-chapel',
  name: 'Grace Chapel',
  kind: 'CHURCH',
  city: 'Leeds',
  country: 'GB',
  currency: 'GBP',
  timezone: 'Europe/London',
  claimStatus: 'UNCLAIMED',
  verificationStatus: 'UNVERIFIED',
  contactName: 'Pastor Ruth',
  contactEmail: 'pastor@grace.org',
  addedByUserId: 'staff1',
  createdAt: NOW,
  deletedAt: null,
  ...over,
});

const eventInput = (over: Record<string, unknown> = {}) => ({
  title: 'Sunday Service',
  category: 'service',
  startsAt: new Date(NOW.getTime() + 7 * DAY).toISOString(),
  endsAt: new Date(NOW.getTime() + 7 * DAY + 2 * 3600 * 1000).toISOString(),
  timezone: 'Europe/London',
  isOnline: true,
  onlineUrl: 'https://example.org/live',
  ticketTypes: [{ name: 'RSVP', priceMinor: 0, currency: 'GBP', quantity: 100 }],
  ...over,
});

const church = (over: Record<string, unknown> = {}) => ({
  name: 'New Hope Church',
  kind: 'church',
  city: 'Manchester',
  country: 'GB',
  contactName: 'Pastor Sam',
  contactEmail: '  Sam@NewHope.org ',
  ...over,
});

function setup(opts: { orgs?: Org[]; events?: Event[]; memberships?: Membership[] } = {}) {
  const db = fakeDb({
    orgs: opts.orgs ?? [],
    events: opts.events ?? [],
    memberships: opts.memberships ?? [],
    tokens: [],
    audits: [],
  });
  const tokens = new ClaimTokensService(db as never);
  const audit = new AuditLogService(db as never);
  const events = {
    create: jest.fn(async (organizationId: string, _actor: string, body: { title: string }) => {
      const e: Event = {
        id: `e${db.state.events.length + 1}`,
        slug: 'sunday-service',
        organizationId,
        title: body.title,
        status: 'DRAFT',
        deletedAt: null,
      };
      db.state.events.push(e);
      return e;
    }),
    publish: jest.fn(async (eventId: string) => {
      const e = db.state.events.find((x) => x.id === eventId)!;
      e.status = 'PUBLISHED';
      return e;
    }),
    cancel: jest.fn(async (eventId: string) => {
      const e = db.state.events.find((x) => x.id === eventId)!;
      e.status = 'CANCELLED';
      return e;
    }),
  };
  /** The links the last invite carried, as ClaimsService.sendInvite issues them. */
  const sent: { claim?: string; takedown?: string } = {};
  const claims = {
    sendInvite: jest.fn(async (organizationId: string, staffId: string) => {
      const email = db.state.orgs.find((o) => o.id === organizationId)!.contactEmail!;
      const issue = (kind: 'CLAIM' | 'TAKEDOWN') =>
        tokens.issue(db as never, { organizationId, email, kind, createdByUserId: staffId });
      sent.claim = await issue('CLAIM');
      sent.takedown = await issue('TAKEDOWN');
      return { sent: true, email, hasAccount: false };
    }),
  };
  const hosts = new AdminHostsService(db as never, audit, events as never, claims as never);
  const adminEvents = new AdminEventsService(db as never, audit, events as never);
  return { db, hosts, adminEvents, events, claims, tokens, sent };
}

/** The HTTP status and body a refused call would answer with. */
async function refusal(p: Promise<unknown>) {
  try {
    await p;
  } catch (err) {
    if (err instanceof HttpException) return { status: err.getStatus(), body: err.getResponse() };
    throw err;
  }
  throw new Error('expected the call to be refused');
}

const actions = (db: { state: State }) => db.state.audits.map((a) => a.action);

describe('AdminHostsService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('match', () => {
    it('duplicate contact email returns matches', async () => {
      const { hosts } = setup({
        orgs: [
          org(),
          org({ id: 'org2', slug: 'other', name: 'Other', contactEmail: 'someone@else.org' }),
        ],
      });
      await expect(hosts.match({ email: 'PASTOR@Grace.org' })).resolves.toEqual({
        items: [
          { id: 'org1', name: 'Grace Chapel', slug: 'grace-chapel', claimStatus: 'UNCLAIMED' },
        ],
      });
    });

    it('matches a similar name, and ignores deleted churches', async () => {
      const { hosts } = setup({
        orgs: [org(), org({ id: 'gone', slug: 'gone', deletedAt: NOW })],
      });
      const res = await hosts.match({ name: 'grace' });
      expect(res.items.map((i) => i.id)).toEqual(['org1']);
    });

    it('answers no matches when given nothing to match on', async () => {
      const { hosts } = setup({ orgs: [org()] });
      await expect(hosts.match({})).resolves.toEqual({ items: [] });
    });
  });

  describe('create', () => {
    it('POST hosts with paid ticket returns FREE_ONLY', async () => {
      const { db, hosts, events } = setup();
      const body = {
        church: church(),
        event: eventInput({
          ticketTypes: [
            { name: 'RSVP', priceMinor: 0, currency: 'GBP', quantity: 100 },
            { name: 'VIP', priceMinor: 500, currency: 'GBP', quantity: 10 },
          ],
        }),
      };
      expect(await refusal(hosts.create('staff1', body, undefined))).toEqual({
        status: 400,
        body: { code: 'FREE_ONLY' },
      });
      expect(db.state.orgs).toHaveLength(0);
      expect(events.create).not.toHaveBeenCalled();
    });

    it('creates an UNCLAIMED, UNVERIFIED church with zero memberships, publishes the event and invites', async () => {
      const { db, hosts, events, claims } = setup();
      const res = await hosts.create(
        'staff1',
        { church: church(), event: eventInput() },
        undefined,
      );

      expect(res).toEqual({
        host: { id: 'org1', slug: 'new-hope-church' },
        event: { id: 'e1', slug: 'sunday-service' },
        inviteSent: true,
      });
      expect(db.state.orgs[0]).toMatchObject({
        name: 'New Hope Church',
        kind: 'CHURCH',
        city: 'Manchester',
        country: 'GB',
        currency: 'GBP',
        claimStatus: 'UNCLAIMED',
        verificationStatus: 'UNVERIFIED',
        addedByUserId: 'staff1',
        contactName: 'Pastor Sam',
        contactEmail: 'sam@newhope.org',
        deletedAt: null,
      });
      expect(db.state.memberships).toHaveLength(0);
      expect(events.create).toHaveBeenCalledWith(
        'org1',
        'staff1',
        expect.objectContaining({ title: 'Sunday Service' }),
      );
      expect(events.publish).toHaveBeenCalledWith('e1', 'staff1');
      expect(db.state.events[0]!.status).toBe('PUBLISHED');
      expect(claims.sendInvite).toHaveBeenCalledWith('org1', 'staff1');
      expect(actions(db)).toEqual(['admin.host.create', 'admin.event.create']);
      expect(db.state.audits[0]).toMatchObject({
        actorUserId: 'staff1',
        organizationId: 'org1',
        targetType: 'organization',
        targetId: 'org1',
      });
      expect(db.state.audits[1]).toMatchObject({
        actorUserId: 'staff1',
        organizationId: 'org1',
        targetType: 'event',
        targetId: 'e1',
      });
    });

    it('takes the currency from the country, as host sign-up does', async () => {
      const { db, hosts } = setup();
      await hosts.create(
        'staff1',
        { church: church({ country: 'IE' }), event: eventInput() },
        undefined,
      );
      expect(db.state.orgs[0]).toMatchObject({ country: 'IE', currency: 'EUR' });
    });

    it('stores the church timezone when given, and defaults to Europe/London', async () => {
      const { db, hosts } = setup();
      await hosts.create(
        'staff1',
        { church: church({ country: 'US', timezone: 'America/New_York' }), event: eventInput() },
        undefined,
      );
      await hosts.create('staff1', { church: church({ name: 'Second Church' }), event: eventInput() }, undefined);
      expect(db.state.orgs[0]).toMatchObject({ country: 'US', currency: 'USD', timezone: 'America/New_York' });
      expect(db.state.orgs[1]).toMatchObject({ timezone: 'Europe/London' });
    });

    it('refuses an unknown timezone (400) before creating anything', async () => {
      const { db, hosts } = setup();
      await expect(
        hosts.create('staff1', { church: church({ timezone: 'Mars/Olympus' }), event: eventInput() }, undefined),
      ).rejects.toMatchObject({ name: 'ZodError' });
      expect(db.state.orgs).toHaveLength(0);
    });

    it('gives a taken or reserved name a different slug', async () => {
      const { db, hosts } = setup({ orgs: [org({ slug: 'new-hope-church' })] });
      const first = await hosts.create(
        'staff1',
        { church: church(), event: eventInput() },
        undefined,
      );
      expect(first.host.slug).toBe('new-hope-church-manchester');
      const admin = await hosts.create(
        'staff1',
        { church: church({ name: 'Admin' }), event: eventInput() },
        undefined,
      );
      expect(admin.host.slug).not.toBe('admin');
      expect(db.state.orgs.map((o) => o.slug)).toHaveLength(3);
    });

    it('answers 409 SLUG_TAKEN when another add takes the slug first', async () => {
      const { db, hosts, events } = setup();
      jest.spyOn(db.organization, 'create').mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError(
          'Unique constraint failed on the fields: (`slug`)',
          {
            code: 'P2002',
            clientVersion: 'test',
          },
        ),
      );
      expect(
        await refusal(hosts.create('staff1', { church: church(), event: eventInput() }, undefined)),
      ).toEqual({ status: 409, body: { code: 'SLUG_TAKEN' } });
      expect(events.create).not.toHaveBeenCalled();
    });

    it('event create failure soft-deletes the new org', async () => {
      const { db, hosts, events, claims } = setup();
      events.create.mockRejectedValueOnce(new Error('wording refused'));
      await expect(
        hosts.create('staff1', { church: church(), event: eventInput() }, undefined),
      ).rejects.toThrow('wording refused');
      expect(db.state.orgs).toHaveLength(1);
      expect(db.state.orgs[0]!.deletedAt).toEqual(NOW);
      expect(claims.sendInvite).not.toHaveBeenCalled();
      expect(actions(db)).not.toContain('admin.event.create');
    });

    it('publish failure soft-deletes the new org and its draft event', async () => {
      const { db, hosts, events, claims } = setup();
      events.publish.mockRejectedValueOnce(new Error('Event end time is in the past'));
      await expect(
        hosts.create('staff1', { church: church(), event: eventInput() }, undefined),
      ).rejects.toThrow('Event end time is in the past');
      expect(db.state.orgs[0]!.deletedAt).toEqual(NOW);
      expect(db.state.events[0]).toMatchObject({ status: 'DRAFT', deletedAt: NOW });
      expect(claims.sendInvite).not.toHaveBeenCalled();
    });

    it('POST hosts with a failed invite still returns 201 with inviteSent:false', async () => {
      const { db, hosts, claims } = setup();
      claims.sendInvite.mockResolvedValueOnce({
        sent: false,
        email: 'sam@newhope.org',
        hasAccount: false,
      });
      const res = await hosts.create(
        'staff1',
        { church: church(), event: eventInput() },
        undefined,
      );
      expect(res.inviteSent).toBe(false);
      expect(db.state.orgs[0]!.deletedAt).toBeNull();
      expect(db.state.events[0]!.status).toBe('PUBLISHED');
    });

    it('keeps the church and event when the invite throws outright', async () => {
      const { db, hosts, claims } = setup();
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      claims.sendInvite.mockRejectedValueOnce(new Error('db blip'));
      const res = await hosts.create(
        'staff1',
        { church: church(), event: eventInput() },
        undefined,
      );
      expect(res.inviteSent).toBe(false);
      expect(db.state.orgs[0]!.deletedAt).toBeNull();
    });

    it('refuses a church with no contact email (400) before creating anything', async () => {
      const { db, hosts } = setup();
      await expect(
        hosts.create(
          'staff1',
          { church: church({ contactEmail: '' }), event: eventInput() },
          undefined,
        ),
      ).rejects.toMatchObject({ name: 'ZodError' });
      expect(db.state.orgs).toHaveLength(0);
    });
  });

  describe('add event', () => {
    it('creates and publishes a free event for an unclaimed church', async () => {
      const { db, hosts, events } = setup({ orgs: [org()] });
      await expect(hosts.addEvent('org1', 'staff1', eventInput(), undefined)).resolves.toEqual({
        event: { id: 'e1', slug: 'sunday-service' },
      });
      expect(events.publish).toHaveBeenCalledWith('e1', 'staff1');
      expect(actions(db)).toEqual(['admin.event.create']);
    });

    it('refuses a claimed church with 409 NOT_UNCLAIMED', async () => {
      const { hosts, events } = setup({ orgs: [org({ claimStatus: 'CLAIMED' })] });
      expect(await refusal(hosts.addEvent('org1', 'staff1', eventInput(), undefined))).toEqual({
        status: 409,
        body: { code: 'NOT_UNCLAIMED' },
      });
      expect(events.create).not.toHaveBeenCalled();
    });

    it('refuses a paid ticket with FREE_ONLY', async () => {
      const { hosts, events } = setup({ orgs: [org()] });
      const body = eventInput({
        ticketTypes: [{ name: 'Paid', priceMinor: 1, currency: 'GBP', quantity: 1 }],
      });
      expect(await refusal(hosts.addEvent('org1', 'staff1', body, undefined))).toEqual({
        status: 400,
        body: { code: 'FREE_ONLY' },
      });
      expect(events.create).not.toHaveBeenCalled();
    });

    it('soft-deletes the draft when publishing fails', async () => {
      const { db, hosts, events } = setup({ orgs: [org()] });
      events.publish.mockRejectedValueOnce(new Error('nope'));
      await expect(hosts.addEvent('org1', 'staff1', eventInput(), undefined)).rejects.toThrow(
        'nope',
      );
      expect(db.state.events[0]!.deletedAt).toEqual(NOW);
      expect(db.state.orgs[0]!.deletedAt).toBeNull();
    });

    it('answers 404 for a deleted church', async () => {
      const { hosts } = setup({ orgs: [org({ deletedAt: NOW })] });
      expect(
        (await refusal(hosts.addEvent('org1', 'staff1', eventInput(), undefined))).status,
      ).toBe(404);
    });
  });

  describe('resend, contact, restore', () => {
    it('resend sends a fresh invite and audits admin.claim.resend', async () => {
      const { db, hosts, claims } = setup({ orgs: [org()] });
      claims.sendInvite.mockResolvedValueOnce({
        sent: false,
        email: 'pastor@grace.org',
        hasAccount: false,
      });
      await expect(hosts.resend('org1', 'staff1', undefined)).resolves.toEqual({
        inviteSent: false,
      });
      expect(claims.sendInvite).toHaveBeenCalledWith('org1', 'staff1');
      expect(db.state.audits).toEqual([
        expect.objectContaining({ action: 'admin.claim.resend', metadata: { sent: false } }),
      ]);
    });

    it('changing the contact updates an unclaimed church, audits, then resends', async () => {
      const { db, hosts, claims } = setup({ orgs: [org()] });
      const res = await hosts.changeContact(
        'org1',
        'staff1',
        { contactName: 'Deacon Joe', contactEmail: 'Joe@Grace.org' },
        undefined,
      );
      expect(res).toEqual({ inviteSent: true });
      expect(db.state.orgs[0]).toMatchObject({
        contactName: 'Deacon Joe',
        contactEmail: 'joe@grace.org',
      });
      expect(claims.sendInvite).toHaveBeenCalledWith('org1', 'staff1');
      expect(actions(db)).toEqual(['admin.host.contact', 'admin.claim.resend']);
      expect(db.state.audits[0]!.metadata).toEqual({
        from: 'pastor@grace.org',
        to: 'joe@grace.org',
      });
    });

    it('refuses to change the contact of a claimed church', async () => {
      const { db, hosts, claims } = setup({ orgs: [org({ claimStatus: 'CLAIMED' })] });
      expect(
        await refusal(
          hosts.changeContact('org1', 'staff1', { contactEmail: 'x@y.org' }, undefined),
        ),
      ).toEqual({ status: 409, body: { code: 'NOT_UNCLAIMED' } });
      expect(db.state.orgs[0]!.contactEmail).toBe('pastor@grace.org');
      expect(claims.sendInvite).not.toHaveBeenCalled();
    });

    it('restore moves DISPUTED to UNCLAIMED without an invite unless asked', async () => {
      const { db, hosts, claims, events } = setup({
        orgs: [org({ claimStatus: 'DISPUTED' })],
        events: [
          {
            id: 'e1',
            slug: 's',
            organizationId: 'org1',
            title: 'S',
            status: 'CANCELLED',
            deletedAt: null,
          },
        ],
      });
      await expect(hosts.restore('org1', 'staff1', {}, undefined)).resolves.toEqual({
        claimStatus: 'UNCLAIMED',
        inviteSent: null,
      });
      expect(db.state.orgs[0]!.claimStatus).toBe('UNCLAIMED');
      expect(db.state.events[0]!.status).toBe('CANCELLED');
      expect(events.publish).not.toHaveBeenCalled();
      expect(claims.sendInvite).not.toHaveBeenCalled();
      expect(actions(db)).toEqual(['admin.host.restore']);
    });

    it('restore sends a new invite when staff ask for one', async () => {
      const { db, hosts, claims } = setup({ orgs: [org({ claimStatus: 'DISPUTED' })] });
      await expect(
        hosts.restore('org1', 'staff1', { sendInvite: true }, undefined),
      ).resolves.toEqual({
        claimStatus: 'UNCLAIMED',
        inviteSent: true,
      });
      expect(claims.sendInvite).toHaveBeenCalledWith('org1', 'staff1');
      expect(actions(db)).toEqual(['admin.host.restore', 'admin.claim.resend']);
    });

    it('a contact change voids every link sent to the old address; the new ones work', async () => {
      const { hosts, tokens, sent } = setup({ orgs: [org()] });
      await hosts.resend('org1', 'staff1', undefined);
      const old = { ...sent };
      await hosts.changeContact('org1', 'staff1', { contactEmail: 'joe@grace.org' }, undefined);

      await expect(tokens.peek(old.claim!, 'CLAIM')).resolves.toEqual({ error: 'USED' });
      await expect(tokens.peek(old.takedown!, 'TAKEDOWN')).resolves.toEqual({ error: 'USED' });
      await expect(tokens.peek(sent.claim!, 'CLAIM')).resolves.toMatchObject({
        token: { email: 'joe@grace.org' },
      });
      await expect(tokens.peek(sent.takedown!, 'TAKEDOWN')).resolves.toMatchObject({
        token: { email: 'joe@grace.org' },
      });
    });

    it('restore voids links sent before the take-down, even with no new invite', async () => {
      const { db, hosts, tokens, sent } = setup({ orgs: [org()] });
      await hosts.resend('org1', 'staff1', undefined);
      const old = { ...sent };
      // An older take-down link survives the take-down itself (only the used
      // one is spent), so it would read as live again once UNCLAIMED.
      db.state.orgs[0]!.claimStatus = 'DISPUTED';
      await hosts.restore('org1', 'staff1', {}, undefined);

      await expect(tokens.peek(old.claim!, 'CLAIM')).resolves.toEqual({ error: 'USED' });
      await expect(tokens.peek(old.takedown!, 'TAKEDOWN')).resolves.toEqual({ error: 'USED' });
    });

    it('restore with a new invite: old links stay dead, the new ones work', async () => {
      const { db, hosts, tokens, sent } = setup({ orgs: [org()] });
      await hosts.resend('org1', 'staff1', undefined);
      const old = { ...sent };
      db.state.orgs[0]!.claimStatus = 'DISPUTED';
      await hosts.restore('org1', 'staff1', { sendInvite: true }, undefined);

      await expect(tokens.peek(old.takedown!, 'TAKEDOWN')).resolves.toEqual({ error: 'USED' });
      await expect(tokens.peek(sent.claim!, 'CLAIM')).resolves.toHaveProperty('token');
      await expect(tokens.peek(sent.takedown!, 'TAKEDOWN')).resolves.toHaveProperty('token');
    });

    it('an invite that throws after a committed contact change answers inviteSent:false', async () => {
      const { db, hosts, claims } = setup({ orgs: [org()] });
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      claims.sendInvite.mockRejectedValueOnce(new Error('db blip'));
      await expect(
        hosts.changeContact('org1', 'staff1', { contactEmail: 'joe@grace.org' }, undefined),
      ).resolves.toEqual({ inviteSent: false });
      expect(db.state.orgs[0]!.contactEmail).toBe('joe@grace.org');
      expect(actions(db)).toEqual(['admin.host.contact', 'admin.claim.resend']);
      expect(db.state.audits[1]!.metadata).toEqual({ sent: false });
    });

    it('an invite that throws after a committed restore answers inviteSent:false', async () => {
      const { db, hosts, claims } = setup({ orgs: [org({ claimStatus: 'DISPUTED' })] });
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      claims.sendInvite.mockRejectedValueOnce(new Error('db blip'));
      await expect(
        hosts.restore('org1', 'staff1', { sendInvite: true }, undefined),
      ).resolves.toEqual({ claimStatus: 'UNCLAIMED', inviteSent: false });
      expect(actions(db)).toEqual(['admin.host.restore', 'admin.claim.resend']);
    });

    it('resend refuses a claimed church with 409 NOT_UNCLAIMED', async () => {
      const { hosts, claims } = setup({ orgs: [org({ claimStatus: 'CLAIMED' })] });
      expect(await refusal(hosts.resend('org1', 'staff1', undefined))).toEqual({
        status: 409,
        body: { code: 'NOT_UNCLAIMED' },
      });
      expect(claims.sendInvite).not.toHaveBeenCalled();
    });

    it('refuses to restore a church that is not taken down', async () => {
      const { db, hosts } = setup({ orgs: [org()] });
      expect(await refusal(hosts.restore('org1', 'staff1', {}, undefined))).toEqual({
        status: 409,
        body: { code: 'NOT_DISPUTED' },
      });
      expect(db.state.audits).toHaveLength(0);
    });
  });
});

describe('AdminEventsService.unpublish', () => {
  it('cancels the event with the reason and audits admin.event.unpublish', async () => {
    const { db, adminEvents, events } = setup({
      orgs: [org()],
      events: [
        {
          id: 'e1',
          slug: 's',
          organizationId: 'org1',
          title: 'S',
          status: 'PUBLISHED',
          deletedAt: null,
        },
      ],
    });
    await expect(
      adminEvents.unpublish('e1', 'staff1', { reason: 'Duplicate listing' }, undefined),
    ).resolves.toEqual({ id: 'e1', status: 'CANCELLED' });
    expect(events.cancel).toHaveBeenCalledWith('e1', 'staff1', 'Duplicate listing');
    expect(db.state.audits).toEqual([
      expect.objectContaining({
        actorUserId: 'staff1',
        organizationId: 'org1',
        action: 'admin.event.unpublish',
        targetType: 'event',
        targetId: 'e1',
        metadata: { reason: 'Duplicate listing' },
      }),
    ]);
  });

  it('needs a reason', async () => {
    const { adminEvents, events } = setup({ orgs: [org()] });
    await expect(
      adminEvents.unpublish('e1', 'staff1', { reason: ' ' }, undefined),
    ).rejects.toMatchObject({
      name: 'ZodError',
    });
    expect(events.cancel).not.toHaveBeenCalled();
  });

  it('answers 404 for a draft, or an event of a deleted church', async () => {
    const ev = (id: string, organizationId: string, status: string): Event => ({
      id,
      slug: id,
      organizationId,
      title: id,
      status,
      deletedAt: null,
    });
    const { adminEvents, events } = setup({
      orgs: [org(), org({ id: 'gone', slug: 'gone', deletedAt: NOW })],
      events: [ev('draft', 'org1', 'DRAFT'), ev('orphan', 'gone', 'PUBLISHED')],
    });
    for (const id of ['draft', 'orphan']) {
      expect(
        (await refusal(adminEvents.unpublish(id, 'staff1', { reason: 'x' }, undefined))).status,
      ).toBe(404);
    }
    expect(events.cancel).not.toHaveBeenCalled();
  });

  it('answers 404 for an unknown event', async () => {
    const { adminEvents } = setup();
    expect(
      (await refusal(adminEvents.unpublish('nope', 'staff1', { reason: 'x' }, undefined))).status,
    ).toBe(404);
  });
});

describe('admin host and event routes: who may call them', () => {
  /** Runs the real guard against the real decorators on an AdminController handler. */
  function gate(handler: keyof AdminController, platformRole: string) {
    const prisma = {
      user: {
        findUnique: async () => ({
          email: 'staff@ekklesiaevents.com',
          platformRole,
          twoFactorEnabled: true,
          deletedAt: null,
        }),
      },
    };
    const currentUser = {
      fromRequest: async () => ({ id: 'u1', email: 'staff@ekklesiaevents.com' }),
    };
    const guard = new PlatformRoleGuard(new Reflector(), currentUser as never, prisma as never);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
      getHandler: () => AdminController.prototype[handler],
      getClass: () => AdminController,
    } as unknown as ExecutionContext;
    return guard.canActivate(ctx);
  }
  const forbidden = { response: { message: 'Not available' } };

  it('support role gets 403 on POST hosts', async () => {
    await expect(gate('createHost', 'PLATFORM_SUPPORT')).rejects.toMatchObject(forbidden);
  });

  it('a moderator may POST hosts', async () => {
    await expect(gate('createHost', 'PLATFORM_MODERATOR')).resolves.toBe(true);
  });

  it('support gets 200 on GET hosts', async () => {
    await expect(gate('listHosts', 'PLATFORM_SUPPORT')).resolves.toBe(true);
  });

  it('finance gets 403 on GET hosts', async () => {
    await expect(gate('listHosts', 'PLATFORM_FINANCE')).rejects.toMatchObject(forbidden);
  });

  it('reads are SUPPORT; every mutation and the match check are MODERATOR', async () => {
    const support: Array<keyof AdminController> = ['listHosts', 'getHost', 'listEvents'];
    const moderator: Array<keyof AdminController> = [
      'matchHosts',
      'createHost',
      'addHostEvent',
      'resendInvite',
      'changeContact',
      'restoreHost',
      'unpublishEvent',
    ];
    for (const h of support) await expect(gate(h, 'PLATFORM_SUPPORT')).resolves.toBe(true);
    for (const h of moderator) {
      await expect(gate(h, 'PLATFORM_SUPPORT')).rejects.toMatchObject(forbidden);
      await expect(gate(h, 'PLATFORM_MODERATOR')).resolves.toBe(true);
    }
  });
});
