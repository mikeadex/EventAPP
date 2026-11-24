import {
  afterSignIn,
  recordSignInAttempt,
  refuseLockedSignIn,
  refuseTwoFactorEnable,
  withoutTwoFactorFlag,
  type StaffSignInDb,
} from './staff-signin.js';

const NOW = new Date('2026-11-24T12:00:00.000Z');
const MINUTE = 60 * 1000;

type Row = {
  id: string;
  email: string;
  platformRole: string;
  failedSignIns: number;
  lockedUntil: Date | null;
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

function mockDb(row: Row | null) {
  const db = {
    user: {
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };
  return { db, asDb: db as unknown as StaffSignInDb };
}

const headers = new Headers({
  'x-forwarded-for': '203.0.113.7, 10.0.0.1',
  'user-agent': 'jest-agent',
});

describe('non-staff sign-in response unchanged', () => {
  it('is a no-op for a USER: no lock check, no writes, no audit', async () => {
    const { db, asDb } = mockDb({ ...member, failedSignIns: 9, lockedUntil: new Date(NOW.getTime() + MINUTE) });

    expect(await refuseLockedSignIn(asDb, member.email, headers, NOW)).toBeNull();
    await afterSignIn(asDb, { email: member.email, outcome: 'failed', headers, now: NOW });
    await afterSignIn(asDb, { email: member.email, outcome: 'ok', headers, now: NOW });

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
    const { asDb } = mockDb(member);
    expect(await refuseTwoFactorEnable(asDb, member.id)).toEqual({
      status: 403,
      body: { code: 'NOT_STAFF' },
    });
  });

  it('refuses a role holder off the staff domain', async () => {
    const { asDb } = mockDb({ ...member, platformRole: 'PLATFORM_ADMIN' });
    expect((await refuseTwoFactorEnable(asDb, member.id))?.status).toBe(403);
  });

  it('refuses a staff-domain address with no role', async () => {
    const { asDb } = mockDb({ ...staff, platformRole: 'USER' });
    expect((await refuseTwoFactorEnable(asDb, staff.id))?.status).toBe(403);
  });

  it('lets staff through', async () => {
    const { asDb } = mockDb(staff);
    expect(await refuseTwoFactorEnable(asDb, staff.id)).toBeNull();
  });

  it('refuses when no session could be resolved, rather than waving it through', async () => {
    const { asDb } = mockDb(null);
    expect((await refuseTwoFactorEnable(asDb, undefined))?.status).toBe(403);
  });
});

describe('recordSignInAttempt', () => {
  it('locks on the 5th failure within the lock window for 15 minutes', async () => {
    const { db, asDb } = mockDb({ ...staff, failedSignIns: 4 });
    const lockedUntil = new Date(NOW.getTime() + 15 * MINUTE);

    expect(await recordSignInAttempt(asDb, staff.email, false, NOW)).toEqual({
      locked: true,
      lockedUntil,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: staff.id },
      data: { failedSignIns: 5, lockedUntil },
    });
  });

  it('counts failures below the threshold without locking', async () => {
    const { db, asDb } = mockDb({ ...staff, failedSignIns: 3 });
    expect(await recordSignInAttempt(asDb, staff.email, false, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: staff.id },
      data: { failedSignIns: 4, lockedUntil: null },
    });
  });

  it('starts a fresh count once an earlier lock has expired', async () => {
    const { db, asDb } = mockDb({
      ...staff,
      failedSignIns: 5,
      lockedUntil: new Date(NOW.getTime() - MINUTE),
    });
    expect(await recordSignInAttempt(asDb, staff.email, false, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: staff.id },
      data: { failedSignIns: 1, lockedUntil: null },
    });
  });

  it('does not extend a lock that is still running', async () => {
    const until = new Date(NOW.getTime() + 5 * MINUTE);
    const { db, asDb } = mockDb({ ...staff, failedSignIns: 5, lockedUntil: until });
    expect(await recordSignInAttempt(asDb, staff.email, false, NOW)).toEqual({
      locked: true,
      lockedUntil: until,
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('resets failedSignIns to 0 on success', async () => {
    const { db, asDb } = mockDb({ ...staff, failedSignIns: 3 });
    expect(await recordSignInAttempt(asDb, staff.email, true, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
    });
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: staff.id },
      data: { failedSignIns: 0, lockedUntil: null },
    });
  });

  it('never locks a non-staff user', async () => {
    const { db, asDb } = mockDb({ ...member, failedSignIns: 40 });
    expect(await recordSignInAttempt(asDb, member.email, false, NOW)).toEqual({
      locked: false,
      lockedUntil: null,
    });
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('looks the address up case-insensitively', async () => {
    const { db, asDb } = mockDb(staff);
    await recordSignInAttempt(asDb, '  Ada@EkklesiaEvents.com ', true, NOW);
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ada@ekklesiaevents.com' } }),
    );
  });
});

describe('refuseLockedSignIn', () => {
  it('answers 423 LOCKED for a locked staff account and audits the attempt', async () => {
    const until = new Date(NOW.getTime() + 10 * MINUTE);
    const { db, asDb } = mockDb({ ...staff, failedSignIns: 5, lockedUntil: until });

    expect(await refuseLockedSignIn(asDb, staff.email, headers, NOW)).toEqual({
      status: 423,
      body: { code: 'LOCKED', lockedUntil: until.toISOString() },
    });
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

  it('lets an unlocked or expired staff account through', async () => {
    const { asDb } = mockDb({ ...staff, lockedUntil: new Date(NOW.getTime() - 1) });
    expect(await refuseLockedSignIn(asDb, staff.email, headers, NOW)).toBeNull();
  });

  it('ignores a missing or non-string email', async () => {
    const { db, asDb } = mockDb(staff);
    expect(await refuseLockedSignIn(asDb, undefined, headers, NOW)).toBeNull();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('afterSignIn audit', () => {
  it('writes staff.signin with IP and user agent on success', async () => {
    const { db, asDb } = mockDb(staff);
    await afterSignIn(asDb, { email: staff.email, outcome: 'ok', headers, now: NOW });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: staff.id,
        action: 'staff.signin',
        metadata: { twoFactorPending: false },
        targetType: 'User',
        targetId: staff.id,
        ipAddress: '203.0.113.7',
        userAgent: 'jest-agent',
      }),
    });
  });

  it('writes staff.signin.failed and reports the lock on the 5th failure', async () => {
    const { db, asDb } = mockDb({ ...staff, failedSignIns: 4 });
    await afterSignIn(asDb, { email: staff.email, outcome: 'failed', headers, now: NOW });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'staff.signin.failed',
        metadata: {
          reason: 'bad_credentials',
          failedSignIns: 5,
          lockedUntil: new Date(NOW.getTime() + 15 * MINUTE).toISOString(),
        },
      }),
    });
  });

  it('does nothing for outcomes that are neither success nor bad credentials', async () => {
    const { db, asDb } = mockDb(staff);
    await afterSignIn(asDb, { email: staff.email, outcome: 'other', headers, now: NOW });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});
