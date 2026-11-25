import { HttpException, Logger } from '@nestjs/common';
import { AuditLogService } from '../../common/audit-log.service.js';
import { ClaimTokensService } from './claim-tokens.service.js';
import { ClaimAccounts, ClaimsService, TAKEDOWN_CANCEL_REASON } from './claims.service.js';

const NOW = new Date('2026-11-24T12:00:00.000Z');

type ClaimStatus = 'CLAIMED' | 'UNCLAIMED' | 'DISPUTED';
type Org = {
  id: string;
  name: string;
  slug: string;
  kind: string;
  claimStatus: ClaimStatus;
  claimedAt: Date | null;
  verificationStatus: string;
  contactName: string | null;
  contactEmail: string | null;
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
type User = {
  id: string;
  email: string;
  name: string;
  platformRole: string;
  /** Treated as true when left out. */
  emailVerified?: boolean;
};
type Session = { id: string; userId: string };
/** A row in one of the per-user tables a takeover must clear (Device, Profile, …). */
type Owned = { model: string; userId: string };
type Account = { userId: string; providerId: string; accountId: string; password: string | null };
type Membership = { userId: string; organizationId: string; role: string; acceptedAt: Date | null };
type Event = {
  id: string;
  organizationId: string;
  title: string;
  startsAt: Date;
  status: string;
  deletedAt: Date | null;
};
type Audit = {
  actorUserId?: string;
  organizationId?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: unknown;
};
type State = {
  orgs: Org[];
  tokens: Token[];
  users: User[];
  sessions: Session[];
  accounts: Account[];
  owned: Owned[];
  memberships: Membership[];
  events: Event[];
  audits: Audit[];
};

type TokenWhere = {
  organizationId?: string;
  kind?: Token['kind'];
  tokenHash?: string;
  usedAt?: null;
  revokedAt?: null;
  OR?: Array<{ expiresAt: null } | { expiresAt: { gte: Date } }>;
};

/**
 * In-memory stand-in for the Prisma calls the claim flow makes.
 *
 * `$transaction` runs one callback at a time (as row locks on the
 * organization would serialise the real ones) and rolls the whole state back
 * if the callback throws, so a test can assert that a refused claim left
 * nothing behind.
 */
function fakeDb(initial: State) {
  let s: State = initial;
  let queue: Promise<unknown> = Promise.resolve();
  const clone = (x: State): State => structuredClone(x);

  const tokenMatches = (r: Token, w: TokenWhere) =>
    (w.organizationId === undefined || r.organizationId === w.organizationId) &&
    (w.kind === undefined || r.kind === w.kind) &&
    (w.tokenHash === undefined || r.tokenHash === w.tokenHash) &&
    (w.usedAt === undefined || r.usedAt === null) &&
    (w.revokedAt === undefined || r.revokedAt === null) &&
    (w.OR === undefined ||
      w.OR.some((c) =>
        c.expiresAt === null
          ? r.expiresAt === null
          : r.expiresAt !== null && r.expiresAt >= c.expiresAt.gte,
      ));

  const db = {
    get state() {
      return s;
    },
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        s.orgs.find((o) => o.id === where.id) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; claimStatus?: ClaimStatus };
        data: Partial<Org>;
      }) => {
        const hit = s.orgs.filter(
          (o) =>
            o.id === where.id &&
            (where.claimStatus === undefined || o.claimStatus === where.claimStatus),
        );
        hit.forEach((o) => Object.assign(o, data));
        return { count: hit.length };
      },
    },
    user: {
      findFirst: async ({ where }: { where: { email: { equals: string } } }) => {
        const u = s.users.find((x) => x.email.toLowerCase() === where.email.equals.toLowerCase());
        return u ? { ...u, emailVerified: u.emailVerified ?? true } : null;
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const u = s.users.find((x) => x.id === where.id);
        return u ? { ...u, emailVerified: u.emailVerified ?? true } : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; emailVerified?: boolean };
        data: Partial<User>;
      }) => {
        const hit = s.users.filter(
          (u) =>
            u.id === where.id &&
            (where.emailVerified === undefined ||
              (u.emailVerified ?? true) === where.emailVerified),
        );
        hit.forEach((u) => Object.assign(u, data));
        return { count: hit.length };
      },
    },
    session: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        const before = s.sessions.length;
        s.sessions = s.sessions.filter((x) => x.userId !== where.userId);
        return { count: before - s.sessions.length };
      },
    },
    ...Object.fromEntries(
      ['device', 'savedEvent', 'consent', 'notificationPreference', 'profile'].map((model) => [
        model,
        {
          deleteMany: async ({ where }: { where: { userId: string } }) => {
            const before = s.owned.length;
            s.owned = s.owned.filter((x) => !(x.model === model && x.userId === where.userId));
            return { count: before - s.owned.length };
          },
        },
      ]),
    ),
    account: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        const before = s.accounts.length;
        s.accounts = s.accounts.filter((x) => x.userId !== where.userId);
        return { count: before - s.accounts.length };
      },
      create: async ({ data }: { data: Account }) => {
        s.accounts.push({ ...data });
        return data;
      },
    },
    organizationMembership: {
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { userId_organizationId: { userId: string; organizationId: string } };
        create: Membership;
        update: Partial<Membership>;
      }) => {
        const k = where.userId_organizationId;
        const found = s.memberships.find(
          (m) => m.userId === k.userId && m.organizationId === k.organizationId,
        );
        if (found) return Object.assign(found, update);
        s.memberships.push({ ...create });
        return create;
      },
    },
    event: {
      findMany: async ({
        where,
      }: {
        where: { organizationId: string; status?: string; deletedAt?: null };
      }) =>
        s.events
          .filter(
            (e) =>
              e.organizationId === where.organizationId &&
              (where.status === undefined || e.status === where.status) &&
              (where.deletedAt === undefined || e.deletedAt === null),
          )
          .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
    },
    auditLog: {
      create: async ({ data }: { data: Audit }) => {
        s.audits.push(data);
        return data;
      },
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
      findFirst: async ({ where }: { where: TokenWhere }) =>
        s.tokens.find((r) => tokenMatches(r, where)) ?? null,
      findUnique: async ({
        where,
        include,
      }: {
        where: { tokenHash: string };
        include?: unknown;
      }) => {
        const r = s.tokens.find((x) => x.tokenHash === where.tokenHash);
        if (!r) return null;
        return include ? { ...r, organization: s.orgs.find((o) => o.id === r.organizationId) } : r;
      },
      findUniqueOrThrow: async ({ where }: { where: { tokenHash: string } }) =>
        s.tokens.find((r) => r.tokenHash === where.tokenHash)!,
      updateMany: async ({ where, data }: { where: TokenWhere; data: Partial<Token> }) => {
        const hit = s.tokens.filter((r) => tokenMatches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
      deleteMany: async ({ where }: { where: TokenWhere }) => {
        const before = s.tokens.length;
        s.tokens = s.tokens.filter((r) => !tokenMatches(r, where));
        return { count: before - s.tokens.length };
      },
    },
    $transaction: <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      const run = queue.then(async () => {
        const snapshot = clone(s);
        try {
          return await fn(db);
        } catch (err) {
          s = snapshot;
          throw err;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
  return db;
}

const org = (over: Partial<Org> = {}): Org => ({
  id: 'org1',
  name: 'Grace Chapel',
  slug: 'grace-chapel',
  kind: 'CHURCH',
  claimStatus: 'UNCLAIMED',
  claimedAt: null,
  verificationStatus: 'UNVERIFIED',
  contactName: 'Pastor Ruth',
  contactEmail: 'Pastor@Grace.org',
  ...over,
});

const event = (id: string, over: Partial<Event> = {}): Event => ({
  id,
  organizationId: 'org1',
  title: `Event ${id}`,
  startsAt: new Date(NOW.getTime() + 7 * 24 * 3600 * 1000),
  status: 'PUBLISHED',
  deletedAt: null,
  ...over,
});

async function setup(
  opts: {
    users?: User[];
    sessions?: Session[];
    accounts?: Account[];
    owned?: Owned[];
    orgs?: Org[];
    events?: Event[];
  } = {},
) {
  const db = fakeDb({
    orgs: opts.orgs ?? [org()],
    tokens: [],
    users: opts.users ?? [],
    sessions: opts.sessions ?? [],
    accounts: opts.accounts ?? [],
    owned: opts.owned ?? [],
    memberships: [],
    events: opts.events ?? [],
    audits: [],
  });
  const tokens = new ClaimTokensService(db as never);
  const audit = new AuditLogService(db as never);
  const events = {
    cancel: jest.fn(async (eventId: string, _actor: string | null, _reason: string) => {
      const e = db.state.events.find((x) => x.id === eventId)!;
      e.status = 'CANCELLED';
      return e;
    }),
  };
  const email = { send: jest.fn(async () => ({ id: null })) };
  const accounts: ClaimAccounts = {
    createPasswordUser: jest.fn(async ({ email: addr, name }) => {
      // Like the unique index on User.email.
      if (db.state.users.some((u) => u.email === addr.toLowerCase())) {
        throw new Error('Unique constraint failed on the fields: (`email`)');
      }
      const user = {
        id: `u${db.state.users.length + 1}`,
        email: addr.toLowerCase(),
        name,
        platformRole: 'USER',
        emailVerified: true,
      };
      db.state.users.push(user);
      return { id: user.id };
    }),
    deleteUser: jest.fn(async (id: string) => {
      db.state.users = db.state.users.filter((u) => u.id !== id);
    }),
    hashPassword: jest.fn(async (password: string) => `hashed:${password}`),
  };
  const svc = new ClaimsService(
    db as never,
    tokens,
    audit,
    email as never,
    events as never,
    accounts,
  );
  const issue = (kind: 'CLAIM' | 'TAKEDOWN', organizationId = 'org1') =>
    tokens.issue(db as never, {
      organizationId,
      email: 'pastor@grace.org',
      kind,
      createdByUserId: 'staff1',
    });
  return { db, svc, tokens, events, email, accounts, issue };
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

const PASSWORD = 'correct horse battery';
/** A signed-in user (and their row), as CurrentUserService would hand over. */
function signedIn(db: { state: State }, email: string, emailVerified = true) {
  if (!db.state.users.some((u) => u.id === 'u_existing')) {
    db.state.users.push({
      id: 'u_existing',
      email: email.toLowerCase(),
      name: 'Signed In',
      platformRole: 'USER',
      emailVerified,
    });
  }
  return { id: 'u_existing', email, platformRole: 'USER' };
}

/** Someone signed up with the contact's address and never confirmed it. */
const squatter: User = {
  id: 'u_squat',
  email: 'pastor@grace.org',
  name: 'Not Ruth',
  platformRole: 'USER',
  emailVerified: false,
};
const squatterSession: Session = { id: 's1', userId: 'u_squat' };
const squatterOwned: Owned[] = [
  'device',
  'savedEvent',
  'consent',
  'notificationPreference',
  'profile',
].map((model) => ({ model, userId: 'u_squat' }));
const squatterAccount: Account = {
  userId: 'u_squat',
  providerId: 'credential',
  accountId: 'u_squat',
  password: 'hashed:attacker-password',
};

describe('ClaimsService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  describe('GET claim', () => {
    it('shows the church, the address, its published events and whether an account exists', async () => {
      const { svc, issue } = await setup({
        events: [
          event('e2', { startsAt: new Date(NOW.getTime() + 9e8) }),
          event('e1'),
          event('draft', { status: 'DRAFT' }),
        ],
      });
      const raw = await issue('CLAIM');
      await expect(svc.getClaim(raw)).resolves.toEqual({
        organization: { name: 'Grace Chapel', slug: 'grace-chapel', kind: 'CHURCH' },
        email: 'pastor@grace.org',
        events: [
          { title: 'Event e1', startsAt: event('e1').startsAt },
          { title: 'Event e2', startsAt: new Date(NOW.getTime() + 9e8) },
        ],
        hasAccount: false,
      });
    });

    it('says hasAccount when an account exists for the address in any case', async () => {
      const { svc, issue } = await setup({
        users: [{ id: 'u9', email: 'PASTOR@grace.org', name: 'R', platformRole: 'USER' }],
      });
      const raw = await issue('CLAIM');
      await expect(svc.getClaim(raw)).resolves.toMatchObject({ hasAccount: true });
    });

    it('answers 410 with a code for unknown and claimed links', async () => {
      const { svc, issue } = await setup();
      expect(await refusal(svc.getClaim('nope'))).toEqual({
        status: 410,
        body: { code: 'INVALID' },
      });
      const raw = await issue('CLAIM');
      await svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined);
      expect(await refusal(svc.getClaim(raw))).toEqual({ status: 410, body: { code: 'CLAIMED' } });
    });
  });

  describe('POST claim with a password', () => {
    it('password claim for existing email returns 409 SIGN_IN', async () => {
      const { db, svc, issue, accounts } = await setup({
        users: [{ id: 'u9', email: 'pastor@grace.org', name: 'R', platformRole: 'USER' }],
      });
      const raw = await issue('CLAIM');
      expect(
        await refusal(svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined)),
      ).toEqual({ status: 409, body: { code: 'SIGN_IN' } });
      expect(accounts.createPasswordUser).not.toHaveBeenCalled();
      expect(db.state.orgs[0]!.claimStatus).toBe('UNCLAIMED');
      expect(db.state.tokens[0]!.usedAt).toBeNull();
    });

    it('refuses a staff account the password path too (it must use attach)', async () => {
      const { svc, issue } = await setup({
        users: [
          {
            id: 'u_staff',
            email: 'pastor@grace.org',
            name: 'Ada',
            platformRole: 'PLATFORM_MODERATOR',
          },
        ],
      });
      const raw = await issue('CLAIM');
      expect(
        await refusal(svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined)),
      ).toEqual({ status: 409, body: { code: 'SIGN_IN' } });
    });

    it('an unverified sign-up with the address does not count as an account', async () => {
      const { svc, issue } = await setup({ users: [{ ...squatter }] });
      const raw = await issue('CLAIM');
      await expect(svc.getClaim(raw)).resolves.toMatchObject({ hasAccount: false });
    });

    it('takes over an unverified pre-registration: verified, new password, old sessions gone', async () => {
      const { db, svc, issue, accounts } = await setup({
        users: [{ ...squatter }],
        sessions: [{ ...squatterSession }, { id: 'other', userId: 'u_other' }],
        accounts: [
          { ...squatterAccount },
          { userId: 'u_squat', providerId: 'google', accountId: 'g-1', password: null },
        ],
        owned: [
          ...squatterOwned,
          { model: 'device', userId: 'u_other' },
          { model: 'savedEvent', userId: 'u_other' },
        ],
      });
      const raw = await issue('CLAIM');

      await expect(
        svc.claimWithPassword(raw, { name: 'Ruth Ade', password: PASSWORD }, undefined),
      ).resolves.toEqual({
        email: 'pastor@grace.org',
        organization: { id: 'org1', slug: 'grace-chapel', name: 'Grace Chapel' },
      });

      expect(accounts.createPasswordUser).not.toHaveBeenCalled();
      expect(db.state.users).toEqual([{ ...squatter, name: 'Ruth Ade', emailVerified: true }]);
      expect(db.state.sessions).toEqual([{ id: 'other', userId: 'u_other' }]);
      // Push tokens, saved events, consents, preferences and profile all go;
      // other people's rows stay.
      expect(db.state.owned).toEqual([
        { model: 'device', userId: 'u_other' },
        { model: 'savedEvent', userId: 'u_other' },
      ]);
      expect(db.state.accounts).toEqual([
        {
          userId: 'u_squat',
          providerId: 'credential',
          accountId: 'u_squat',
          password: `hashed:${PASSWORD}`,
        },
      ]);
      expect(db.state.memberships).toEqual([
        { userId: 'u_squat', organizationId: 'org1', role: 'OWNER', acceptedAt: NOW },
      ]);
      expect(db.state.orgs[0]!.claimStatus).toBe('CLAIMED');
      expect(db.state.audits).toEqual([
        expect.objectContaining({
          action: 'host.claim',
          actorUserId: 'u_squat',
          metadata: { via: 'password', takeover: 'unverified-account' },
        }),
      ]);
    });

    it('a refused take-over changes nothing on the unverified account', async () => {
      const { db, svc, issue } = await setup({
        users: [{ ...squatter }],
        sessions: [{ ...squatterSession }],
        accounts: [{ ...squatterAccount }],
        owned: [...squatterOwned],
        orgs: [org({ claimStatus: 'DISPUTED' })],
      });
      const raw = await issue('CLAIM');
      expect(
        await refusal(svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined)),
      ).toEqual({ status: 410, body: { code: 'USED' } });
      expect(db.state.users).toEqual([squatter]);
      expect(db.state.sessions).toEqual([squatterSession]);
      expect(db.state.accounts).toEqual([squatterAccount]);
      expect(db.state.owned).toEqual(squatterOwned);
    });

    it('never takes over an unverified staff-role account', async () => {
      const { db, svc, issue } = await setup({
        users: [{ ...squatter, platformRole: 'PLATFORM_ADMIN' }],
      });
      const raw = await issue('CLAIM');
      expect(
        await refusal(svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined)),
      ).toEqual({ status: 409, body: { code: 'SIGN_IN' } });
      expect(db.state.users[0]!.emailVerified).toBe(false);
    });

    it('creates the account, makes it OWNER, claims the church and spends the links', async () => {
      const { db, svc, issue, accounts } = await setup();
      const raw = await issue('CLAIM');
      const takedown = await issue('TAKEDOWN');

      await expect(
        svc.claimWithPassword(raw, { name: '  Ruth Ade ', password: PASSWORD }, undefined),
      ).resolves.toEqual({
        email: 'pastor@grace.org',
        organization: { id: 'org1', slug: 'grace-chapel', name: 'Grace Chapel' },
      });

      expect(accounts.createPasswordUser).toHaveBeenCalledWith({
        email: 'pastor@grace.org',
        name: 'Ruth Ade',
        password: PASSWORD,
      });
      const userId = db.state.users[0]!.id;
      expect(db.state.memberships).toEqual([
        { userId, organizationId: 'org1', role: 'OWNER', acceptedAt: NOW },
      ]);
      expect(db.state.orgs[0]).toMatchObject({
        claimStatus: 'CLAIMED',
        claimedAt: NOW,
        verificationStatus: 'UNVERIFIED',
      });
      expect(db.state.tokens.find((t) => t.kind === 'CLAIM')!.usedAt).toEqual(NOW);
      expect(db.state.tokens.find((t) => t.kind === 'TAKEDOWN')!.revokedAt).toEqual(NOW);
      expect(db.state.audits).toEqual([
        expect.objectContaining({
          action: 'host.claim',
          actorUserId: userId,
          organizationId: 'org1',
          targetType: 'organization',
          targetId: 'org1',
        }),
      ]);
      // The raw token is never written anywhere.
      expect(JSON.stringify(db.state.audits)).not.toContain(raw);
      expect(JSON.stringify(db.state.audits)).not.toContain(takedown);
    });

    it('rejects a password outside 12–128 characters with a 400 and creates nothing', async () => {
      const { svc, issue, accounts } = await setup();
      const raw = await issue('CLAIM');
      await expect(
        svc.claimWithPassword(raw, { name: 'Ruth', password: 'short' }, undefined),
      ).rejects.toMatchObject({ name: 'ZodError' });
      await expect(
        svc.claimWithPassword(raw, { name: 'Ruth', password: 'x'.repeat(129) }, undefined),
      ).rejects.toMatchObject({ name: 'ZodError' });
      expect(accounts.createPasswordUser).not.toHaveBeenCalled();
    });

    it('a spent link answers 410 USED and creates no second account', async () => {
      const { svc, issue, accounts } = await setup();
      const raw = await issue('CLAIM');
      await issue('CLAIM'); // a resend voids the first link
      expect(
        await refusal(svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined)),
      ).toEqual({ status: 410, body: { code: 'USED' } });
      expect(accounts.createPasswordUser).not.toHaveBeenCalled();
    });
  });

  describe('POST claim for the signed-in account', () => {
    it('attach rejects mismatched email', async () => {
      const { db, svc, issue } = await setup();
      const raw = await issue('CLAIM');
      expect(await refusal(svc.attach(raw, signedIn(db, 'someone@else.org'), undefined))).toEqual({
        status: 403,
        body: { code: 'EMAIL_MISMATCH' },
      });
      expect(db.state.memberships).toEqual([]);
      expect(db.state.tokens[0]!.usedAt).toBeNull();
    });

    it('attach refuses a signed-in account whose address is not verified', async () => {
      const { db, svc, issue } = await setup();
      const raw = await issue('CLAIM');
      expect(
        await refusal(svc.attach(raw, signedIn(db, 'pastor@grace.org', false), undefined)),
      ).toEqual({
        status: 403,
        body: { code: 'EMAIL_NOT_VERIFIED' },
      });
      expect(db.state.memberships).toEqual([]);
      expect(db.state.orgs[0]!.claimStatus).toBe('UNCLAIMED');
    });

    it('attach refuses a staff account', async () => {
      const { db, svc, issue } = await setup({
        users: [
          {
            id: 'u_existing',
            email: 'pastor@grace.org',
            name: 'Ada',
            platformRole: 'PLATFORM_MODERATOR',
          },
        ],
      });
      const raw = await issue('CLAIM');
      const user = {
        id: 'u_existing',
        email: 'pastor@grace.org',
        platformRole: 'PLATFORM_MODERATOR',
      };
      expect(await refusal(svc.attach(raw, user, undefined))).toEqual({
        status: 403,
        body: { code: 'STAFF_ACCOUNT' },
      });
      expect(db.state.memberships).toEqual([]);
      expect(db.state.orgs[0]!.claimStatus).toBe('UNCLAIMED');
    });

    it('attaches the church to the signed-in account, matching the address in any case', async () => {
      const { db, svc, issue } = await setup();
      const raw = await issue('CLAIM');
      await issue('TAKEDOWN');
      await expect(svc.attach(raw, signedIn(db, 'PASTOR@Grace.ORG'), undefined)).resolves.toEqual({
        organization: { id: 'org1', slug: 'grace-chapel', name: 'Grace Chapel' },
      });
      expect(db.state.memberships).toEqual([
        { userId: 'u_existing', organizationId: 'org1', role: 'OWNER', acceptedAt: NOW },
      ]);
      expect(db.state.orgs[0]!.claimStatus).toBe('CLAIMED');
      expect(db.state.tokens.find((t) => t.kind === 'TAKEDOWN')!.revokedAt).toEqual(NOW);
      expect(db.state.audits).toEqual([
        expect.objectContaining({ action: 'host.claim', actorUserId: 'u_existing' }),
      ]);
    });
  });

  describe('take-down', () => {
    it('GET shows the church name', async () => {
      const { svc, issue } = await setup();
      const raw = await issue('TAKEDOWN');
      await expect(svc.getTakedown(raw)).resolves.toEqual({
        organization: { name: 'Grace Chapel' },
      });
    });

    it('takedown after claim is 410', async () => {
      const { db, svc, issue, events } = await setup({ events: [event('e1')] });
      const claim = await issue('CLAIM');
      const takedown = await issue('TAKEDOWN');
      await svc.attach(claim, signedIn(db, 'pastor@grace.org'), undefined);

      expect(await refusal(svc.getTakedown(takedown))).toEqual({
        status: 410,
        body: { code: 'CLAIMED' },
      });
      expect(await refusal(svc.takedown(takedown, {}, undefined))).toEqual({
        status: 410,
        body: { code: 'CLAIMED' },
      });
      expect(events.cancel).not.toHaveBeenCalled();
      expect(db.state.orgs[0]!.claimStatus).toBe('CLAIMED');
    });

    it("takedown cancels only that org's published events and hides the church", async () => {
      const { db, svc, issue, events } = await setup({
        orgs: [org(), org({ id: 'org2', slug: 'other', name: 'Other' })],
        events: [
          event('e1'),
          event('e2'),
          event('draft', { status: 'DRAFT' }),
          event('gone', { deletedAt: NOW }),
          event('other', { organizationId: 'org2' }),
        ],
      });
      const claim = await issue('CLAIM');
      const raw = await issue('TAKEDOWN');

      await expect(svc.takedown(raw, { reason: '  Not our church ' }, undefined)).resolves.toEqual({
        cancelledEvents: 2,
      });

      expect(events.cancel.mock.calls).toEqual([
        ['e1', null, TAKEDOWN_CANCEL_REASON],
        ['e2', null, TAKEDOWN_CANCEL_REASON],
      ]);
      expect(TAKEDOWN_CANCEL_REASON).toBe("Removed at the church's request");
      expect(db.state.events.find((e) => e.id === 'other')!.status).toBe('PUBLISHED');
      expect(db.state.orgs[0]!.claimStatus).toBe('DISPUTED');
      expect(db.state.orgs[1]!.claimStatus).toBe('UNCLAIMED');
      expect(db.state.tokens.find((t) => t.kind === 'TAKEDOWN')!.usedAt).toEqual(NOW);
      // The claim link stops working too.
      expect(await refusal(svc.getClaim(claim))).toEqual({ status: 410, body: { code: 'USED' } });
      expect(db.state.audits).toEqual([
        expect.objectContaining({
          action: 'host.disputed',
          organizationId: 'org1',
          targetType: 'organization',
          targetId: 'org1',
          metadata: { reason: 'Not our church' },
        }),
      ]);
      expect(db.state.audits[0]!.actorUserId).toBeUndefined();
    });

    it('a second take-down answers 410 USED', async () => {
      const { svc, issue } = await setup();
      const raw = await issue('TAKEDOWN');
      await svc.takedown(raw, {}, undefined);
      expect(await refusal(svc.takedown(raw, {}, undefined))).toEqual({
        status: 410,
        body: { code: 'USED' },
      });
    });

    it('rejects a reason over 1000 characters', async () => {
      const { svc, issue } = await setup();
      const raw = await issue('TAKEDOWN');
      await expect(
        svc.takedown(raw, { reason: 'x'.repeat(1001) }, undefined),
      ).rejects.toMatchObject({ name: 'ZodError' });
    });

    it('keeps going when one event fails to cancel, and reports how many did', async () => {
      const { db, svc, issue, events } = await setup({ events: [event('e1'), event('e2')] });
      events.cancel.mockImplementationOnce(async () => {
        throw new Error('boom');
      });
      const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const raw = await issue('TAKEDOWN');
      await expect(svc.takedown(raw, {}, undefined)).resolves.toEqual({ cancelledEvents: 1 });
      expect(events.cancel).toHaveBeenCalledTimes(2);
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('could not cancel event e1'));
      logged.mockRestore();
      expect(db.state.orgs[0]!.claimStatus).toBe('DISPUTED');
      expect(db.state.audits.map((a) => [a.action, a.metadata])).toEqual([
        ['host.disputed', {}],
        ['host.disputed.cancel_failed', { failedEventIds: ['e1'] }],
      ]);
    });

    it('writes no cancel_failed audit when every event is cancelled', async () => {
      const { db, svc, issue } = await setup({ events: [event('e1')] });
      await svc.takedown(await issue('TAKEDOWN'), {}, undefined);
      expect(db.state.audits.map((a) => a.action)).toEqual(['host.disputed']);
    });
  });

  describe('races', () => {
    it('two racing claims on one link: exactly one wins, the other is 410', async () => {
      const { db, svc, issue } = await setup();
      const raw = await issue('CLAIM');
      const user = signedIn(db, 'pastor@grace.org');
      const results = await Promise.allSettled([
        svc.attach(raw, user, undefined),
        svc.attach(raw, user, undefined),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect((lost.reason as HttpException).getStatus()).toBe(410);
      expect(db.state.memberships).toHaveLength(1);
      expect(db.state.audits.filter((a) => a.action === 'host.claim')).toHaveLength(1);
    });

    it('two racing password claims: one wins, the other is refused and leaves no account', async () => {
      const { db, svc, issue } = await setup();
      const raw = await issue('CLAIM');
      const body = { name: 'Ruth', password: PASSWORD };
      const results = await Promise.allSettled([
        svc.claimWithPassword(raw, body, undefined),
        svc.claimWithPassword(raw, body, undefined),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect([409, 410]).toContain((lost.reason as HttpException).getStatus());
      expect(db.state.users).toHaveLength(1);
      expect(db.state.memberships).toHaveLength(1);
    });

    it('two racing take-overs of one unverified account: exactly one wins', async () => {
      const { db, svc, issue } = await setup({ users: [{ ...squatter }] });
      const raw = await issue('CLAIM');
      const results = await Promise.allSettled([
        svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined),
        svc.claimWithPassword(raw, { name: 'Ruth', password: PASSWORD }, undefined),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      expect(db.state.memberships).toHaveLength(1);
      expect(db.state.accounts).toHaveLength(1);
    });

    it('a claim that loses to a take-down is 410 USED and writes nothing', async () => {
      const { db, svc, tokens, issue, accounts } = await setup({ events: [event('e1')] });
      const claim = await issue('CLAIM');
      const takedown = await issue('TAKEDOWN');
      // Both pages were opened before either button was pressed.
      const stalePeek = await tokens.peek(claim, 'CLAIM');
      await svc.takedown(takedown, {}, undefined);
      jest.spyOn(tokens, 'peek').mockResolvedValueOnce(stalePeek);

      expect(
        await refusal(
          svc.claimWithPassword(claim, { name: 'Ruth', password: PASSWORD }, undefined),
        ),
      ).toEqual({ status: 410, body: { code: 'USED' } });
      expect(db.state.orgs[0]!.claimStatus).toBe('DISPUTED');
      expect(db.state.memberships).toEqual([]);
      expect(db.state.audits.map((a) => a.action)).toEqual(['host.disputed']);
      // The account made for the claim was removed again.
      expect(accounts.deleteUser).toHaveBeenCalledTimes(1);
      expect(db.state.users).toEqual([]);
    });

    it('a take-down that loses to a claim is 410 CLAIMED and cancels nothing', async () => {
      const { db, svc, tokens, issue, events } = await setup({ events: [event('e1')] });
      const claim = await issue('CLAIM');
      const takedown = await issue('TAKEDOWN');
      const stalePeek = await tokens.peek(takedown, 'TAKEDOWN');
      await svc.attach(claim, signedIn(db, 'pastor@grace.org'), undefined);
      jest.spyOn(tokens, 'peek').mockResolvedValueOnce(stalePeek);

      expect(await refusal(svc.takedown(takedown, {}, undefined))).toEqual({
        status: 410,
        body: { code: 'CLAIMED' },
      });
      expect(db.state.orgs[0]!.claimStatus).toBe('CLAIMED');
      expect(events.cancel).not.toHaveBeenCalled();
      expect(db.state.audits.map((a) => a.action)).toEqual(['host.claim']);
    });

    it('a claim and a take-down at the same moment: exactly one wins', async () => {
      const { db, svc, issue, events } = await setup({ events: [event('e1')] });
      const claim = await issue('CLAIM');
      const takedown = await issue('TAKEDOWN');
      const results = await Promise.allSettled([
        svc.attach(claim, signedIn(db, 'pastor@grace.org'), undefined),
        svc.takedown(takedown, {}, undefined),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
      const status = db.state.orgs[0]!.claimStatus;
      if (status === 'CLAIMED') {
        expect(events.cancel).not.toHaveBeenCalled();
        expect(db.state.memberships).toHaveLength(1);
      } else {
        expect(status).toBe('DISPUTED');
        expect(db.state.memberships).toHaveLength(0);
      }
    });
  });

  describe('sendInvite', () => {
    const OLD_ENV = { ...process.env };
    let warn: jest.SpyInstance;
    let error: jest.SpyInstance;
    beforeEach(() => {
      process.env.WEB_URL = 'https://ekklesiaevents.com';
      process.env.RESEND_API_KEY = 're_test';
      warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    });
    afterEach(() => {
      process.env = { ...OLD_ENV };
      warn.mockRestore();
      error.mockRestore();
    });

    type Sent = { to: string; text: string; html: string; required: boolean; tags: unknown };
    const sentAt = (email: { send: jest.Mock }, i: number) =>
      (email.send.mock.calls[i] as unknown[])[0] as Sent;
    const linkIn = (text: string, path: 'claim' | 'takedown') =>
      text.match(new RegExp(`/${path}/([A-Za-z0-9_-]+)`))![1]!;

    it('issues both links and sends the invite with both', async () => {
      const { db, svc, tokens, email } = await setup();
      await expect(svc.sendInvite('org1', 'staff1')).resolves.toEqual({
        sent: true,
        email: 'pastor@grace.org',
        hasAccount: false,
      });
      expect(db.state.tokens.map((t) => [t.kind, t.email, t.createdByUserId])).toEqual([
        ['CLAIM', 'pastor@grace.org', 'staff1'],
        ['TAKEDOWN', 'pastor@grace.org', 'staff1'],
      ]);
      const sent = sentAt(email, 0);
      expect(sent).toMatchObject({
        to: 'pastor@grace.org',
        required: true,
        tags: [{ name: 'type', value: 'claim-invite' }],
      });
      const claimRaw = linkIn(sent.text, 'claim');
      const takedownRaw = linkIn(sent.text, 'takedown');
      expect(sent.text).toContain(`https://ekklesiaevents.com/claim/${claimRaw}`);
      expect(sent.text).toContain(`https://ekklesiaevents.com/takedown/${takedownRaw}`);
      expect(await tokens.peek(claimRaw, 'CLAIM')).toMatchObject({ organization: { id: 'org1' } });
      expect(await tokens.peek(takedownRaw, 'TAKEDOWN')).toMatchObject({
        organization: { id: 'org1' },
      });
      expect(sent.html).toContain(`/claim/${claimRaw}`);
      expect(sent.html).toContain(`/takedown/${takedownRaw}`);
    });

    it('a resend carries both links, voids the old claim link and keeps the old take-down link', async () => {
      const { svc, tokens, email } = await setup();
      await svc.sendInvite('org1', 'staff1');
      await svc.sendInvite('org1', 'staff1');
      const first = sentAt(email, 0);
      const second = sentAt(email, 1);
      expect(await tokens.peek(linkIn(first.text, 'claim'), 'CLAIM')).toEqual({ error: 'USED' });
      expect(await tokens.peek(linkIn(second.text, 'claim'), 'CLAIM')).toMatchObject({
        organization: { id: 'org1' },
      });
      for (const mail of [first, second]) {
        expect(await tokens.peek(linkIn(mail.text, 'takedown'), 'TAKEDOWN')).toMatchObject({
          organization: { id: 'org1' },
        });
      }
    });

    it('every take-down link dies once the church is claimed', async () => {
      const { db, svc, tokens, email } = await setup();
      await svc.sendInvite('org1', 'staff1');
      await svc.sendInvite('org1', 'staff1');
      const claim = linkIn(sentAt(email, 1).text, 'claim');
      await svc.attach(claim, signedIn(db, 'pastor@grace.org'), undefined);
      for (const i of [0, 1]) {
        const raw = linkIn(sentAt(email, i).text, 'takedown');
        expect(await refusal(svc.takedown(raw, {}, undefined))).toEqual({
          status: 410,
          body: { code: 'CLAIMED' },
        });
      }
      expect(await tokens.peek(linkIn(sentAt(email, 0).text, 'takedown'), 'TAKEDOWN')).toEqual({
        error: 'USED',
      });
    });

    it('uses the "sign in to manage it" wording when the address already has an account', async () => {
      const { svc, email } = await setup({
        users: [{ id: 'u9', email: 'pastor@grace.org', name: 'R', platformRole: 'USER' }],
      });
      await expect(svc.sendInvite('org1', 'staff1')).resolves.toMatchObject({
        sent: true,
        hasAccount: true,
      });
      const sent = sentAt(email, 0);
      expect(sent.tags).toEqual([{ name: 'type', value: 'claim-added' }]);
      expect(sent.text).toMatch(/sign in to manage it/i);
      expect(sent.text).toMatch(/\/claim\//);
      expect(sent.text).toMatch(/\/takedown\//);
    });

    it('a failed send answers sent: false and leaves the issued links in place', async () => {
      const { db, svc, email } = await setup();
      email.send.mockRejectedValueOnce(new Error('resend down'));
      await expect(svc.sendInvite('org1', 'staff1')).resolves.toMatchObject({ sent: false });
      expect(error).toHaveBeenCalledWith(expect.stringContaining('resend down'));
      expect(db.state.tokens.map((t) => [t.kind, t.revokedAt])).toEqual([
        ['CLAIM', null],
        ['TAKEDOWN', null],
      ]);
    });

    it('logs both links (dev only) when email is not configured outside production', async () => {
      delete process.env.RESEND_API_KEY;
      process.env.NODE_ENV = 'development';
      const { svc, email } = await setup();
      await svc.sendInvite('org1', 'staff1');
      const sent = sentAt(email, 0);
      expect(warn).toHaveBeenCalledTimes(1);
      const line = warn.mock.calls[0]![0] as string;
      expect(line).toMatch(/dev-only/);
      expect(line).toContain(`/claim/${linkIn(sent.text, 'claim')}`);
      expect(line).toContain(`/takedown/${linkIn(sent.text, 'takedown')}`);
    });

    it('never logs the links in production or when email is configured', async () => {
      delete process.env.RESEND_API_KEY;
      process.env.NODE_ENV = 'production';
      const { svc } = await setup();
      await svc.sendInvite('org1', 'staff1');
      process.env.NODE_ENV = 'development';
      process.env.RESEND_API_KEY = 're_test';
      await svc.sendInvite('org1', 'staff1');
      expect(warn).not.toHaveBeenCalled();
    });

    it('refuses a church that is not unclaimed, or has no contact address', async () => {
      const claimed = await setup({ orgs: [org({ claimStatus: 'CLAIMED' })] });
      expect(await refusal(claimed.svc.sendInvite('org1', 'staff1'))).toEqual({
        status: 409,
        body: { code: 'NOT_UNCLAIMED' },
      });
      const noContact = await setup({ orgs: [org({ contactEmail: null })] });
      expect(await refusal(noContact.svc.sendInvite('org1', 'staff1'))).toEqual({
        status: 409,
        body: { code: 'NO_CONTACT_EMAIL' },
      });
    });
  });

  describe('renew an expired claim link', () => {
    const OLD_ENV = { ...process.env };
    const EIGHT_DAYS = 8 * 24 * 3600 * 1000;
    beforeEach(() => {
      process.env.WEB_URL = 'https://ekklesiaevents.com';
      process.env.RESEND_API_KEY = 're_test';
    });
    afterEach(() => {
      process.env = { ...OLD_ENV };
    });
    const later = () => jest.setSystemTime(new Date(NOW.getTime() + EIGHT_DAYS));
    const sentText = (email: { send: jest.Mock }, i: number) =>
      ((email.send.mock.calls[i] as unknown[])[0] as { to: string; text: string });

    it('emails a fresh link to the address on file, spends the old one and answers only { sent }', async () => {
      const { db, svc, tokens, email, issue } = await setup();
      const raw = await issue('CLAIM');
      later();
      const res = await svc.renewClaim(raw, undefined);
      expect(res).toEqual({ sent: true });
      expect(email.send).toHaveBeenCalledTimes(1);
      const mail = sentText(email, 0);
      expect(mail.to).toBe('pastor@grace.org');
      const fresh = mail.text.match(/\/claim\/([A-Za-z0-9_-]+)/)![1]!;
      expect(await tokens.peek(fresh, 'CLAIM')).toMatchObject({ organization: { id: 'org1' } });
      expect(await tokens.peek(raw, 'CLAIM')).toEqual({ error: 'USED' });
      // A contact-asked renewal has no staff actor.
      expect(db.state.tokens.filter((t) => t.createdByUserId === null).map((t) => t.kind)).toEqual(
        ['CLAIM', 'TAKEDOWN'],
      );
      expect(db.state.audits).toEqual([
        expect.objectContaining({
          action: 'host.claim.renew',
          organizationId: 'org1',
          metadata: { sent: true },
        }),
      ]);
      expect(db.state.audits[0]!.actorUserId).toBeUndefined();
    });

    it('renews a link once: replaying it answers 410 USED and sends nothing more', async () => {
      const { svc, email, issue } = await setup();
      const raw = await issue('CLAIM');
      later();
      await svc.renewClaim(raw, undefined);
      expect(await refusal(svc.renewClaim(raw, undefined))).toEqual({
        status: 410,
        body: { code: 'USED' },
      });
      expect(email.send).toHaveBeenCalledTimes(1);
    });

    it('two racing renewals of one link send one email', async () => {
      const { svc, email, issue } = await setup();
      const raw = await issue('CLAIM');
      later();
      const results = await Promise.allSettled([
        svc.renewClaim(raw, undefined),
        svc.renewClaim(raw, undefined),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(email.send).toHaveBeenCalledTimes(1);
    });

    it('refuses a link that still works with 409 NOT_EXPIRED', async () => {
      const { svc, email, issue } = await setup();
      const raw = await issue('CLAIM');
      expect(await refusal(svc.renewClaim(raw, undefined))).toEqual({
        status: 409,
        body: { code: 'NOT_EXPIRED' },
      });
      expect(email.send).not.toHaveBeenCalled();
    });

    it('answers the same 410 codes as the claim page for unknown, claimed and taken-down links', async () => {
      const unknown = await setup();
      expect(await refusal(unknown.svc.renewClaim('nope', undefined))).toEqual({
        status: 410,
        body: { code: 'INVALID' },
      });

      const claimed = await setup();
      const raw = await claimed.issue('CLAIM');
      await claimed.svc.attach(raw, signedIn(claimed.db, 'pastor@grace.org'), undefined);
      later();
      expect(await refusal(claimed.svc.renewClaim(raw, undefined))).toEqual({
        status: 410,
        body: { code: 'CLAIMED' },
      });

      jest.setSystemTime(NOW);
      const down = await setup();
      const claim = await down.issue('CLAIM');
      const takedown = await down.issue('TAKEDOWN');
      await down.svc.takedown(takedown, {}, undefined);
      later();
      expect(await refusal(down.svc.renewClaim(claim, undefined))).toEqual({
        status: 410,
        body: { code: 'USED' },
      });
      for (const s of [unknown, claimed, down]) expect(s.email.send).not.toHaveBeenCalled();
    });

    it("never sends to an address other than the church's current contact", async () => {
      const { db, svc, email, issue } = await setup();
      const raw = await issue('CLAIM');
      db.state.orgs[0]!.contactEmail = 'someone-else@grace.org';
      later();
      expect(await refusal(svc.renewClaim(raw, undefined))).toEqual({
        status: 410,
        body: { code: 'USED' },
      });
      expect(email.send).not.toHaveBeenCalled();
    });
  });
});
