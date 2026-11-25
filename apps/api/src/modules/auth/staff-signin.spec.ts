import {
  afterCodeCheck,
  afterSignIn,
  afterTrustedDeviceSignIn,
  afterTwoFactorDisabled,
  afterTwoFactorEnrolled,
  auditTwoFactorChange,
  clientIp,
  guardStaffCodeCheck,
  guardStaffSignIn,
  recordSignInAttempt,
  refuseStaffSession,
  refuseTwoFactorEnable,
  withoutTwoFactorFlag,
  type StaffSignInDb,
} from './staff-signin.js';

const NOW = new Date('2026-11-24T12:00:00.000Z');
const MINUTE = 60 * 1000;
const LOCK_END = new Date(NOW.getTime() + 15 * MINUTE);

type Row = {
  id: string;
  email: string;
  platformRole: string;
  failedSignIns: number;
  lockedUntil: Date | null;
  twoFactorEnabled?: boolean;
};

const staff: Row = {
  id: 'u_staff',
  email: 'ada@ekklesiaevents.com',
  platformRole: 'PLATFORM_MODERATOR',
  failedSignIns: 0,
  lockedUntil: null,
};
const member: Row = {
  id: 'u_member',
  email: 'member@example.com',
  platformRole: 'USER',
  failedSignIns: 0,
  lockedUntil: null,
};

type Where = {
  id?: string;
  email?: string;
  failedSignIns?: { lt: number };
  lockedUntil?: null | { lte: Date };
};
type Data = { failedSignIns?: number | { increment: number }; lockedUntil?: Date | null };

/**
 * One-row in-memory stand-in for prisma.user that honours the conditional
 * `where` the lockout relies on, applied atomically (JS is single-threaded
 * between awaits, like a single UPDATE … WHERE in Postgres). `staleReads`
 * makes findUnique keep returning the row as it was at the start, to prove the
 * cap does not depend on a fresh read.
 */
type SessionRow = { id: string; userId: string; token: string };

function fakeDb(
  initial: Row | null,
  opts: { staleReads?: boolean; sessions?: SessionRow[] } = {},
) {
  const row = initial ? { ...initial } : null;
  let sessions = [...(opts.sessions ?? [])];
  const snapshot = initial ? { ...initial } : null;
  const matches = (w: Where) => {
    if (!row) return false;
    if (w.id !== undefined && w.id !== row.id) return false;
    if (w.email !== undefined && w.email !== row.email) return false;
    if (w.failedSignIns && !(row.failedSignIns < w.failedSignIns.lt)) return false;
    if (w.lockedUntil === null && row.lockedUntil !== null) return false;
    if (w.lockedUntil && !(row.lockedUntil && row.lockedUntil <= w.lockedUntil.lte)) return false;
    return true;
  };
  const apply = (d: Data) => {
    if (!row) return;
    if (typeof d.failedSignIns === 'number') row.failedSignIns = d.failedSignIns;
    else if (d.failedSignIns) row.failedSignIns += d.failedSignIns.increment;
    if ('lockedUntil' in d) row.lockedUntil = d.lockedUntil ?? null;
  };
  const tick = () => new Promise((r) => setImmediate(r));
  const db = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: Where }) => {
        await tick();
        const source = opts.staleReads ? snapshot : row;
        return source && matches({ id: where.id, email: where.email }) ? { ...source } : null;
      }),
      update: jest.fn(async ({ where, data }: { where: Where; data: Data }) => {
        await tick();
        if (!matches(where)) throw Object.assign(new Error('not found'), { code: 'P2025' });
        apply(data);
        return { ...row! };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Where; data: Data }) => {
        await tick();
        if (!matches(where)) return { count: 0 };
        apply(data);
        return { count: 1 };
      }),
    },
    session: {
      deleteMany: jest.fn(
        async ({ where }: { where: { userId: string; id?: { not: string } } }) => {
          const before = sessions.length;
          sessions = sessions.filter(
            (x) => !(x.userId === where.userId && (!where.id || x.id !== where.id.not)),
          );
          return { count: before - sessions.length };
        },
      ),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return {
    db,
    asDb: db as unknown as StaffSignInDb,
    current: () => row,
    sessions: () => sessions,
  };
}

const headers = new Headers({
  'x-forwarded-for': '198.51.100.66, 203.0.113.7',
  'user-agent': 'jest-agent',
});

describe('non-staff sign-in response unchanged', () => {
  it('does no database work at all for an address off the staff domain', async () => {
    const { db, asDb } = fakeDb(member);

    expect(await guardStaffSignIn(asDb, member.email, headers, NOW)).toBeNull();
    await afterSignIn(asDb, { email: member.email, outcome: 'failed', headers, now: NOW });
    await afterSignIn(asDb, { email: member.email, outcome: 'ok', headers, now: NOW });
    expect(await guardStaffCodeCheck(asDb, member, headers, NOW)).toBeNull();
    await afterCodeCheck(asDb, { user: member, outcome: 'bad_code', headers, now: NOW });
    await afterCodeCheck(asDb, { user: member, outcome: 'ok', headers, now: NOW });
    await afterTrustedDeviceSignIn(asDb, member, headers, NOW);
    await afterTwoFactorEnrolled(asDb, member, 's_new', headers);
    await afterTwoFactorDisabled(asDb, member, headers);
    await auditTwoFactorChange(asDb, member, 'staff.2fa.enable', headers);

    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.session.deleteMany).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('is a no-op for a staff-domain address with no role', async () => {
    const { db, asDb } = fakeDb({ ...staff, platformRole: 'USER' });
    expect(await guardStaffSignIn(asDb, staff.email, headers, NOW)).toBeNull();
    await afterSignIn(asDb, { email: staff.email, outcome: 'failed', headers, now: NOW });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('strips only the two-factor plugin flag, keeping every other byte of the body', () => {
    const body = {
      redirect: false,
      token: 'tok',
      user: {
        name: 'M',
        email: member.email,
        emailVerified: true,
        image: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        twoFactorEnabled: false,
        id: 'u_member',
      },
    };
    const out = withoutTwoFactorFlag(body);
    const { twoFactorEnabled: _flag, ...user } = body.user;
    expect(JSON.stringify(out)).toBe(JSON.stringify({ ...body, user }));
  });

  it('leaves bodies without a user (errors, 2-step redirect) untouched', () => {
    const redirect = { twoFactorRedirect: true, twoFactorMethods: ['totp'] };
    expect(withoutTwoFactorFlag(redirect)).toBe(redirect);
    expect(withoutTwoFactorFlag(undefined)).toBeUndefined();
  });
});

describe('non-staff cannot enable two-factor', () => {
  it('refuses a USER with 403', async () => {
    const { asDb } = fakeDb(member);
    expect(await refuseTwoFactorEnable(asDb, member.id)).toEqual({
      status: 403,
      body: { code: 'NOT_STAFF' },
    });
  });

  it('refuses a role holder off the staff domain', async () => {
    const { asDb } = fakeDb({ ...member, platformRole: 'PLATFORM_ADMIN' });
    expect((await refuseTwoFactorEnable(asDb, member.id))?.status).toBe(403);
  });

  it('refuses a staff-domain address with no role', async () => {
    const { asDb } = fakeDb({ ...staff, platformRole: 'USER' });
    expect((await refuseTwoFactorEnable(asDb, staff.id))?.status).toBe(403);
  });

  it('lets staff through', async () => {
    const { asDb } = fakeDb(staff);
    expect(await refuseTwoFactorEnable(asDb, staff.id)).toBeNull();
  });

  it('refuses when no session could be resolved, rather than waving it through', async () => {
    const { asDb } = fakeDb(null);
    expect((await refuseTwoFactorEnable(asDb, undefined))?.status).toBe(403);
  });
});

describe('lockout', () => {
  async function wrongPassword(asDb: StaffSignInDb) {
    const refusal = await guardStaffSignIn(asDb, staff.email, headers, NOW);
    if (!refusal) await afterSignIn(asDb, { email: staff.email, outcome: 'failed', headers, now: NOW });
    return refusal;
  }

  it('the 5th failure within the lock window locks for 15 minutes; the 6th gets 423', async () => {
    const { asDb, current } = fakeDb(staff);
    for (let i = 0; i < 4; i++) expect(await wrongPassword(asDb)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 4, lockedUntil: null });

    expect(await wrongPassword(asDb)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 5, lockedUntil: LOCK_END });

    expect(await wrongPassword(asDb)).toEqual({
      status: 423,
      body: { code: 'LOCKED', lockedUntil: LOCK_END.toISOString() },
    });
  });

  it('lets at most 5 concurrent attempts through, even when every read is stale', async () => {
    const { asDb, current } = fakeDb(staff, { staleReads: true });
    const results = await Promise.all(
      Array.from({ length: 12 }, () => guardStaffSignIn(asDb, staff.email, headers, NOW)),
    );
    expect(results.filter((r) => r === null)).toHaveLength(5);
    expect(results.filter((r) => r?.status === 423)).toHaveLength(7);
    expect(current()).toMatchObject({ failedSignIns: 5, lockedUntil: LOCK_END });
  });

  it('refuses a locked account with 423 and audits the attempt', async () => {
    const until = new Date(NOW.getTime() + 10 * MINUTE);
    const { db, asDb } = fakeDb({ ...staff, failedSignIns: 5, lockedUntil: until });

    expect(await guardStaffSignIn(asDb, staff.email, headers, NOW)).toEqual({
      status: 423,
      body: { code: 'LOCKED', lockedUntil: until.toISOString() },
    });
    expect(db.user.update).not.toHaveBeenCalled();
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: staff.id,
        action: 'staff.signin.failed',
        metadata: { reason: 'locked' },
        ipAddress: '203.0.113.7',
        userAgent: 'jest-agent',
      }),
    });
  });

  it('starts a fresh count once an earlier lock has expired', async () => {
    const { asDb, current } = fakeDb({
      ...staff,
      failedSignIns: 5,
      lockedUntil: new Date(NOW.getTime() - MINUTE),
    });
    expect(await guardStaffSignIn(asDb, staff.email, headers, NOW)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 1, lockedUntil: null });
  });

  it('success resets failedSignIns to 0 (and clears a lock taken by the 5th try)', async () => {
    const { asDb, current } = fakeDb({ ...staff, failedSignIns: 4 });
    expect(await guardStaffSignIn(asDb, staff.email, headers, NOW)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 5, lockedUntil: LOCK_END });

    expect(await recordSignInAttempt(asDb, staff.email, true, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
    });
    expect(current()).toMatchObject({ failedSignIns: 0, lockedUntil: null });
  });

  it('recordSignInAttempt reports the lock after the 5th failure', async () => {
    const { asDb } = fakeDb({ ...staff, failedSignIns: 4 });
    await guardStaffSignIn(asDb, staff.email, headers, NOW);
    expect(await recordSignInAttempt(asDb, staff.email, false, NOW)).toEqual({
      locked: true,
      lockedUntil: LOCK_END,
    });
  });

  it('never locks a non-staff user', async () => {
    const { db, asDb } = fakeDb({ ...member, platformRole: 'PLATFORM_ADMIN' });
    for (let i = 0; i < 8; i++) expect(await wrongPassword(asDb)).toBeNull();
    expect(await recordSignInAttempt(asDb, member.email, false, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('looks the address up case-insensitively', async () => {
    const { db, asDb } = fakeDb(staff);
    await recordSignInAttempt(asDb, '  Ada@EkklesiaEvents.com ', true, NOW);
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ada@ekklesiaevents.com' } }),
    );
  });
});

describe('sign-in audit', () => {
  it('writes staff.signin { step: password } with IP and user agent on success', async () => {
    const { db, asDb } = fakeDb(staff);
    await afterSignIn(asDb, { email: staff.email, outcome: 'ok', headers, now: NOW });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: staff.id,
        action: 'staff.signin',
        targetType: 'User',
        targetId: staff.id,
        metadata: { step: 'password' },
        ipAddress: '203.0.113.7',
        userAgent: 'jest-agent',
      },
    });
  });

  it('writes staff.signin.failed with the count and lock on the 5th failure', async () => {
    const { db, asDb } = fakeDb({ ...staff, failedSignIns: 4 });
    await guardStaffSignIn(asDb, staff.email, headers, NOW);
    await afterSignIn(asDb, { email: staff.email, outcome: 'failed', headers, now: NOW });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'staff.signin.failed',
        metadata: {
          reason: 'bad_credentials',
          failedSignIns: 5,
          lockedUntil: LOCK_END.toISOString(),
        },
      }),
    });
  });

  it('writes staff.signin { step: two-factor } after a code is verified', async () => {
    const { db, asDb } = fakeDb(staff);
    await afterCodeCheck(asDb, { user: staff, outcome: 'ok', headers, now: NOW });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'staff.signin',
        metadata: { step: 'two-factor' },
        actorUserId: staff.id,
      }),
    });
  });

  it('does nothing for outcomes that are neither success nor bad credentials', async () => {
    const { db, asDb } = fakeDb(staff);
    await afterSignIn(asDb, { email: staff.email, outcome: 'other', headers, now: NOW });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe('clientIp', () => {
  it('prefers x-vercel-forwarded-for', () => {
    const h = new Headers({
      'x-vercel-forwarded-for': '192.0.2.1',
      'x-real-ip': '192.0.2.2',
      'x-forwarded-for': '6.6.6.6, 192.0.2.3',
    });
    expect(clientIp(h)).toBe('192.0.2.1');
  });
  it('then x-real-ip', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '192.0.2.2', 'x-forwarded-for': '6.6.6.6' }))).toBe(
      '192.0.2.2',
    );
  });
  it('then the right-most x-forwarded-for entry, never the client-supplied left-most', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1, 192.0.2.3' }))).toBe(
      '192.0.2.3',
    );
  });
  it('is undefined with none of them', () => {
    expect(clientIp(new Headers())).toBeUndefined();
    expect(clientIp(undefined)).toBeUndefined();
  });
});

describe('staff sessions only from the staff sign-in routes', () => {
  const via = (path: string | undefined, currentSessionUserId?: string) => ({
    userId: staff.id,
    path,
    currentSessionUserId,
  });

  it.each(['/callback/:id', '/one-time-token/verify', '/verify-email', undefined])(
    'refuses a staff session created via %s',
    async (path) => {
      const { asDb } = fakeDb(staff);
      expect(await refuseStaffSession(asDb, via(path))).toEqual({
        status: 403,
        body: { code: 'USE_STAFF_SIGN_IN' },
      });
    },
  );

  it('allows a non-staff session via the same social path', async () => {
    const { asDb } = fakeDb(member);
    expect(
      await refuseStaffSession(asDb, { userId: member.id, path: '/callback/:id', currentSessionUserId: undefined }),
    ).toBeNull();
  });

  it.each(['/sign-in/email', '/two-factor/verify-totp', '/two-factor/verify-backup-code'])(
    'allows staff via %s without a database read',
    async (path) => {
      const { db, asDb } = fakeDb(staff);
      expect(await refuseStaffSession(asDb, via(path))).toBeNull();
      expect(db.user.findUnique).not.toHaveBeenCalled();
    },
  );

  it('allows rotating a session the caller already holds for the same account', async () => {
    const { asDb } = fakeDb(staff);
    expect(await refuseStaffSession(asDb, via('/change-password', staff.id))).toBeNull();
  });

  it('does not treat someone else’s session as a rotation', async () => {
    const { asDb } = fakeDb(staff);
    expect((await refuseStaffSession(asDb, via('/change-password', 'u_other')))?.status).toBe(403);
  });
});

describe('2-step code checks count toward the lockout', () => {
  const twoStep: Row = { ...staff, twoFactorEnabled: true };

  /** One password step then a code check, as the hooks in auth.ts run them. */
  async function rightPassword(asDb: StaffSignInDb) {
    const refusal = await guardStaffSignIn(asDb, staff.email, headers, NOW);
    if (!refusal) await afterSignIn(asDb, { email: staff.email, outcome: 'ok', headers, now: NOW });
    return refusal;
  }
  async function code(asDb: StaffSignInDb, ok: boolean) {
    const refusal = await guardStaffCodeCheck(asDb, staff, headers, NOW);
    if (!refusal) {
      await afterCodeCheck(asDb, { user: staff, outcome: ok ? 'ok' : 'bad_code', headers, now: NOW });
    }
    return refusal;
  }

  it('a right password does not reset the counter for an account with 2-step on', async () => {
    const { asDb, current } = fakeDb({ ...twoStep, failedSignIns: 3 });
    expect(await rightPassword(asDb)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 4, lockedUntil: null });
  });

  it('still resets it for an account without 2-step (it signs in at the password step)', async () => {
    const { asDb, current } = fakeDb({ ...staff, failedSignIns: 3 });
    expect(await rightPassword(asDb)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 0 });
  });

  it('wrong codes lock the account after 5 tries in all, and the next code check gets 423', async () => {
    const { asDb, current } = fakeDb(twoStep);
    expect(await rightPassword(asDb)).toBeNull(); // 1
    for (let i = 0; i < 3; i++) expect(await code(asDb, false)).toBeNull(); // 2..4
    expect(current()).toMatchObject({ failedSignIns: 4, lockedUntil: null });
    expect(await code(asDb, false)).toBeNull(); // 5 → locked
    expect(current()).toMatchObject({ failedSignIns: 5, lockedUntil: LOCK_END });

    // Even the right code is refused while locked, in the password lockout's shape.
    expect(await code(asDb, true)).toEqual({
      status: 423,
      body: { code: 'LOCKED', lockedUntil: LOCK_END.toISOString() },
    });
    expect(current()).toMatchObject({ failedSignIns: 5, lockedUntil: LOCK_END });
  });

  it('cannot be reset by signing in with the password again between rounds of guesses', async () => {
    const { asDb, current } = fakeDb(twoStep);
    for (let round = 0; round < 2; round++) {
      await rightPassword(asDb);
      await code(asDb, false);
    }
    expect(current()).toMatchObject({ failedSignIns: 4 });
    expect(await rightPassword(asDb)).toBeNull(); // the 5th slot, which locks
    expect((await code(asDb, false))?.status).toBe(423);
  });

  it('lets at most 5 concurrent code checks through, even when every read is stale', async () => {
    const { asDb, current } = fakeDb(twoStep, { staleReads: true });
    const results = await Promise.all(
      Array.from({ length: 9 }, () => guardStaffCodeCheck(asDb, staff, headers, NOW)),
    );
    expect(results.filter((r) => r === null)).toHaveLength(5);
    expect(results.filter((r) => r?.status === 423)).toHaveLength(4);
    expect(current()).toMatchObject({ failedSignIns: 5, lockedUntil: LOCK_END });
  });

  it('an accepted code clears the counter and audits the sign-in', async () => {
    const { db, asDb, current } = fakeDb(twoStep);
    await rightPassword(asDb);
    await code(asDb, false);
    expect(await code(asDb, true)).toBeNull();
    expect(current()).toMatchObject({ failedSignIns: 0, lockedUntil: null });
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ action: 'staff.signin', metadata: { step: 'two-factor' } }),
    });
  });

  it("audits a wrong code as staff.signin.failed { reason: 'bad_code' } with IP and user agent", async () => {
    const { db, asDb } = fakeDb({ ...twoStep, failedSignIns: 4 });
    await code(asDb, false);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorUserId: staff.id,
        action: 'staff.signin.failed',
        targetType: 'User',
        targetId: staff.id,
        metadata: { reason: 'bad_code', failedSignIns: 5, lockedUntil: LOCK_END.toISOString() },
        ipAddress: '203.0.113.7',
        userAgent: 'jest-agent',
      },
    });
  });

  it('does nothing when the plugin could not tell whose code it was, or for other errors', async () => {
    const { db, asDb } = fakeDb(twoStep);
    expect(await guardStaffCodeCheck(asDb, undefined, headers, NOW)).toBeNull();
    await afterCodeCheck(asDb, { user: undefined, outcome: 'bad_code', headers, now: NOW });
    await afterCodeCheck(asDb, { user: staff, outcome: 'other', headers, now: NOW });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it('a trusted-device sign-in (no code step) clears the counter for a 2-step account', async () => {
    const { db, asDb, current } = fakeDb({ ...twoStep, failedSignIns: 2 });
    await rightPassword(asDb);
    expect(current()).toMatchObject({ failedSignIns: 3 });
    await afterTrustedDeviceSignIn(asDb, staff, headers, NOW);
    expect(current()).toMatchObject({ failedSignIns: 0, lockedUntil: null });
    expect(db.auditLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ action: 'staff.signin', metadata: { step: 'trusted-device' } }),
    });
  });
});

describe('2-step setup and removal end sessions that never passed a code', () => {
  const sessions: SessionRow[] = [
    { id: 's_mobile', userId: staff.id, token: 'bearer-before-setup' },
    { id: 's_web_old', userId: staff.id, token: 'cookie-before-setup' },
    { id: 's_new', userId: staff.id, token: 'issued-by-verify-totp' },
    { id: 's_other', userId: 'u_someone_else', token: 'not-theirs' },
  ];

  it('setup keeps only the session verify-totp just issued, and audits it', async () => {
    const { db, asDb, sessions: left } = fakeDb(staff, { sessions });
    await afterTwoFactorEnrolled(asDb, staff, 's_new', headers);
    expect(left().map((x) => x.id)).toEqual(['s_new', 's_other']);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'staff.2fa.enrolled',
        actorUserId: staff.id,
        metadata: { sessionsEnded: 2 },
        ipAddress: '203.0.113.7',
      }),
    });
  });

  it('ends every session of the account when the new one is unknown (fails closed)', async () => {
    const { asDb, sessions: left } = fakeDb(staff, { sessions });
    await afterTwoFactorEnrolled(asDb, staff, undefined, headers);
    expect(left().map((x) => x.id)).toEqual(['s_other']);
  });

  it('disabling 2-step ends every session of the account and audits it', async () => {
    const { db, asDb, sessions: left } = fakeDb(staff, { sessions });
    await afterTwoFactorDisabled(asDb, staff, headers);
    expect(left().map((x) => x.id)).toEqual(['s_other']);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'staff.2fa.disable',
        metadata: { sessionsEnded: 3 },
      }),
    });
  });

  it.each(['staff.2fa.enable', 'staff.2fa.backup_codes'] as const)('audits %s for staff', async (action) => {
    const { db, asDb } = fakeDb(staff);
    await auditTwoFactorChange(asDb, staff, action, headers);
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action, actorUserId: staff.id, userAgent: 'jest-agent' }),
    });
  });

  it('touches no session of a staff-domain address without a role', async () => {
    const { db, asDb, sessions: left } = fakeDb({ ...staff, platformRole: 'USER' }, { sessions });
    await afterTwoFactorEnrolled(asDb, staff, 's_new', headers);
    await afterTwoFactorDisabled(asDb, staff, headers);
    expect(left()).toHaveLength(4);
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
