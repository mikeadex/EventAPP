import type { Prisma, PrismaClient } from '@prisma/client';
import { clientIp } from '../../common/client-ip.js';
import { isStaffEmail } from '../../common/staff.js';

/**
 * Staff sign-in protection, applied from Better Auth hooks in auth.ts.
 *
 * Everything here acts only on staff accounts — a platform role *and* an
 * address on the staff domain. For anyone else every function is a no-op, and
 * the sign-in hooks return before touching the database when the address is
 * not on the staff domain, so the mobile app's sign-in (same endpoint, bearer
 * tokens) is untouched.
 *
 * Kept free of Better Auth imports: better-auth is ESM-only and this API is
 * CommonJS, so auth.ts turns a `Refusal` into Better Auth's APIError.
 */

export const MAX_FAILED_SIGN_INS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

/**
 * The only routes that may create a session for a staff account: the
 * password step (which the twoFactor plugin turns into a code step once
 * 2-step is on) and the two code checks that finish it.
 */
export const STAFF_SESSION_PATHS: readonly string[] = [
  '/sign-in/email',
  '/two-factor/verify-totp',
  '/two-factor/verify-backup-code',
];

/** The slice of Prisma these hooks use, so tests can hand in a mock. */
export type StaffSignInDb = {
  user: Pick<PrismaClient['user'], 'findUnique' | 'update' | 'updateMany'>;
  session: Pick<PrismaClient['session'], 'deleteMany'>;
  auditLog: Pick<PrismaClient['auditLog'], 'create'>;
};

export interface Refusal {
  status: 403 | 423;
  body: Record<string, string>;
}

/** Sign-in outcome as far as lockout cares: bad credentials, success, or neither. */
export type SignInOutcome = 'ok' | 'failed' | 'other';

/**
 * Staff for these hooks: a platform role and the staff domain. 2-step is not
 * required here — a staff account must be able to sign in to set it up.
 */
export function isStaffAccount(u: { email: string; platformRole: string }): boolean {
  return u.platformRole !== 'USER' && isStaffEmail(u.email);
}

const staffSelect = {
  id: true,
  email: true,
  platformRole: true,
  failedSignIns: true,
  lockedUntil: true,
  twoFactorEnabled: true,
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

/** Staff row for an address, or null. Never queries for an off-domain address. */
async function findStaffByEmail(db: StaffSignInDb, email: unknown): Promise<StaffRow | null> {
  if (typeof email !== 'string' || !isStaffEmail(email)) return null;
  const user = (await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: staffSelect,
  })) as StaffRow | null;
  return user && isStaffAccount(user) ? user : null;
}

async function findStaffById(db: StaffSignInDb, id: string): Promise<StaffRow | null> {
  const user = (await db.user.findUnique({ where: { id }, select: staffSelect })) as StaffRow | null;
  return user && isStaffAccount(user) ? user : null;
}

function isLocked(user: { lockedUntil: Date | null }, now: Date): boolean {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

function isNotFound(err: unknown): boolean {
  return (err as { code?: unknown } | null)?.code === 'P2025';
}

export { clientIp };

type StaffAuditAction =
  | 'staff.signin'
  | 'staff.signin.failed'
  | 'staff.2fa.enable'
  | 'staff.2fa.enrolled'
  | 'staff.2fa.disable'
  | 'staff.2fa.backup_codes';

async function audit(
  db: StaffSignInDb,
  user: { id: string },
  action: StaffAuditAction,
  headers: Headers | undefined,
  metadata: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      action,
      targetType: 'User',
      targetId: user.id,
      metadata,
      ipAddress: clientIp(headers),
      userAgent: headers?.get('user-agent') ?? undefined,
    },
  });
}

async function refuseLocked(
  db: StaffSignInDb,
  user: StaffRow,
  headers: Headers | undefined,
  now: Date,
): Promise<Refusal> {
  // Between the 5th reservation and its lock being written, lockedUntil can
  // still read null; the lock it is about to get is now + 15 minutes.
  const lockedUntil =
    user.lockedUntil && user.lockedUntil > now
      ? user.lockedUntil
      : new Date(now.getTime() + LOCK_DURATION_MS);
  await audit(db, user, 'staff.signin.failed', headers, { reason: 'locked' });
  return { status: 423, body: { code: 'LOCKED', lockedUntil: lockedUntil.toISOString() } };
}

/**
 * Before `/sign-in/email`: reserve one of the 5 attempts, atomically.
 *
 * The reservation is a conditional increment (`failedSignIns < 5` and not
 * locked), so concurrent wrong passwords cannot get more than 5 tries between
 * them — a stale read cannot let a 6th through. The attempt that takes the
 * 5th slot locks the account for 15 minutes; a completed sign-in then clears
 * it (afterSignIn, afterCodeCheck). A locked account, or one with no slot
 * left, gets 423.
 */
export async function guardStaffSignIn(
  db: StaffSignInDb,
  email: unknown,
  headers: Headers | undefined,
  now: Date,
): Promise<Refusal | null> {
  const user = await findStaffByEmail(db, email);
  if (!user) return null;
  return reserveAttempt(db, user, headers, now);
}

/**
 * Before `/two-factor/verify-totp` and `/verify-backup-code`: the same
 * reservation as the password step, so wrong codes count toward the same 5
 * and a locked account cannot keep guessing codes. `user` is the account the
 * code is for (the pending sign-in, or the signed-in account during setup);
 * undefined when Better Auth could not tell, in which case the endpoint
 * refuses on its own.
 */
export async function guardStaffCodeCheck(
  db: StaffSignInDb,
  user: { id: string; email: string } | undefined,
  headers: Headers | undefined,
  now: Date,
): Promise<Refusal | null> {
  if (!user || !isStaffEmail(user.email)) return null;
  const staff = await findStaffById(db, user.id);
  if (!staff) return null;
  return reserveAttempt(db, staff, headers, now);
}

async function reserveAttempt(
  db: StaffSignInDb,
  user: StaffRow,
  headers: Headers | undefined,
  now: Date,
): Promise<Refusal | null> {
  if (isLocked(user, now)) return refuseLocked(db, user, headers, now);

  // A lock that has run out starts a fresh count. Conditional on the lock
  // still being the expired one, so concurrent resets cannot undo a reservation.
  if (user.lockedUntil) {
    await db.user.updateMany({
      where: { id: user.id, lockedUntil: { lte: now } },
      data: { failedSignIns: 0, lockedUntil: null },
    });
  }

  let reserved: { failedSignIns: number };
  try {
    reserved = await db.user.update({
      where: { id: user.id, failedSignIns: { lt: MAX_FAILED_SIGN_INS }, lockedUntil: null },
      data: { failedSignIns: { increment: 1 } },
      select: { failedSignIns: true },
    });
  } catch (err) {
    if (!isNotFound(err)) throw err;
    const current = (await db.user.findUnique({
      where: { id: user.id },
      select: staffSelect,
    })) as StaffRow | null;
    return refuseLocked(db, current ?? user, headers, now);
  }

  if (reserved.failedSignIns >= MAX_FAILED_SIGN_INS) {
    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(now.getTime() + LOCK_DURATION_MS) },
    });
  }
  return null;
}

/**
 * Settle a staff sign-in attempt that guardStaffSignIn already reserved:
 * success clears the counter and any lock; a failure keeps its reserved slot
 * (the 5th one has already locked the account). Non-staff: no-op.
 */
export async function recordSignInAttempt(
  db: StaffSignInDb,
  email: string,
  ok: boolean,
  now: Date,
): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const user = await findStaffByEmail(db, email);
  if (!user) return { locked: false, lockedUntil: null };
  return settle(db, user, ok, now);
}

async function settle(db: StaffSignInDb, user: StaffRow, ok: boolean, now: Date) {
  if (ok) {
    await db.user.update({
      where: { id: user.id },
      data: { failedSignIns: 0, lockedUntil: null },
    });
    return { locked: false, lockedUntil: null };
  }
  return { locked: isLocked(user, now), lockedUntil: isLocked(user, now) ? user.lockedUntil : null };
}

/**
 * After `/sign-in/email`: settle the attempt and audit it, for staff only.
 *
 * A right password is only half a sign-in for an account with 2-step on, so
 * it does not clear the counter: the code step does (afterCodeCheck), or the
 * trusted-device shortcut does (afterTrustedDeviceSignIn). Otherwise someone
 * holding the password could reset the count before every round of guesses.
 */
export async function afterSignIn(
  db: StaffSignInDb,
  input: { email: unknown; outcome: SignInOutcome; headers: Headers | undefined; now: Date },
): Promise<void> {
  const { email, outcome, headers, now } = input;
  // 'other' (unverified address, malformed body) keeps its reserved slot:
  // cheaper to be conservative than to refund under concurrency.
  if (outcome === 'other') return;
  const user = await findStaffByEmail(db, email);
  if (!user) return;
  if (outcome === 'ok') {
    if (!user.twoFactorEnabled) await settle(db, user, true, now);
    await audit(db, user, 'staff.signin', headers, { step: 'password' });
  } else {
    const result = await settle(db, user, false, now);
    await audit(db, user, 'staff.signin.failed', headers, {
      reason: 'bad_credentials',
      failedSignIns: user.failedSignIns,
      lockedUntil: result.lockedUntil?.toISOString() ?? null,
    });
  }
}

/**
 * After `/sign-in/email` has run every hook, the twoFactor plugin's included:
 * a 2-step account that got a full session without the code step came in on a
 * trusted device, so this is where its sign-in completes and the counter
 * clears. Call only when a session was issued and no code step is pending.
 */
export async function afterTrustedDeviceSignIn(
  db: StaffSignInDb,
  user: { id: string; email: string },
  headers: Headers | undefined,
  now: Date,
): Promise<void> {
  if (!isStaffEmail(user.email)) return;
  const staff = await findStaffById(db, user.id);
  if (!staff?.twoFactorEnabled) return;
  await settle(db, staff, true, now);
  await audit(db, staff, 'staff.signin', headers, { step: 'trusted-device' });
}

/** Outcome of a code check: accepted, a wrong code, or anything else. */
export type CodeOutcome = 'ok' | 'bad_code' | 'other';

/**
 * After `/two-factor/verify-totp` or `/verify-backup-code`, for staff only:
 * an accepted code completes the sign-in (counter cleared, audited); a wrong
 * code keeps the slot guardStaffCodeCheck reserved and is audited as a failed
 * sign-in. Anything else (expired code step, malformed body) keeps its slot.
 */
export async function afterCodeCheck(
  db: StaffSignInDb,
  input: {
    user: { id: string; email: string } | undefined;
    outcome: CodeOutcome;
    headers: Headers | undefined;
    now: Date;
  },
): Promise<void> {
  const { user, outcome, headers, now } = input;
  if (outcome === 'other' || !user || !isStaffEmail(user.email)) return;
  const staff = await findStaffById(db, user.id);
  if (!staff) return;
  if (outcome === 'ok') {
    await settle(db, staff, true, now);
    await audit(db, staff, 'staff.signin', headers, { step: 'two-factor' });
    return;
  }
  const result = await settle(db, staff, false, now);
  await audit(db, staff, 'staff.signin.failed', headers, {
    reason: 'bad_code',
    failedSignIns: staff.failedSignIns,
    lockedUntil: result.lockedUntil?.toISOString() ?? null,
  });
}

/**
 * After 2-step setup completes (the first accepted code for an account that
 * had it off). Better Auth replaces only the session that made the request,
 * so every other session of the account — password-only ones, a mobile bearer
 * token among them — would otherwise pass the admin guard once the account
 * reads `twoFactorEnabled`. End all of them but the one just issued.
 *
 * `keepSessionId` undefined ends every session: failing closed costs a
 * sign-in, failing open costs the code step.
 */
export async function afterTwoFactorEnrolled(
  db: StaffSignInDb,
  user: { id: string; email: string },
  keepSessionId: string | undefined,
  headers: Headers | undefined,
): Promise<void> {
  if (!isStaffEmail(user.email)) return;
  const staff = await findStaffById(db, user.id);
  if (!staff) return;
  const { count } = await db.session.deleteMany({
    where: keepSessionId ? { userId: staff.id, id: { not: keepSessionId } } : { userId: staff.id },
  });
  await audit(db, staff, 'staff.2fa.enrolled', headers, { sessionsEnded: count });
}

/**
 * After `/two-factor/disable` for staff: end every session, the one Better
 * Auth just issued included, so nothing signed in without a code survives and
 * the account has to sign in and set 2-step up again.
 */
export async function afterTwoFactorDisabled(
  db: StaffSignInDb,
  user: { id: string; email: string },
  headers: Headers | undefined,
): Promise<void> {
  if (!isStaffEmail(user.email)) return;
  const staff = await findStaffById(db, user.id);
  if (!staff) return;
  const { count } = await db.session.deleteMany({ where: { userId: staff.id } });
  await audit(db, staff, 'staff.2fa.disable', headers, { sessionsEnded: count });
}

/** Audit a staff 2-step change that needs nothing else (setup started, new backup codes). */
export async function auditTwoFactorChange(
  db: StaffSignInDb,
  user: { id: string; email: string },
  action: 'staff.2fa.enable' | 'staff.2fa.backup_codes',
  headers: Headers | undefined,
): Promise<void> {
  if (!isStaffEmail(user.email)) return;
  const staff = await findStaffById(db, user.id);
  if (!staff) return;
  await audit(db, staff, action, headers, {});
}

/**
 * Before any session is created (Better Auth `databaseHooks.session.create`):
 * a staff account gets a session only through the staff sign-in routes, so
 * Google/Microsoft, email-verification auto sign-in or any other route cannot
 * skip the code, the lockout or the audit.
 *
 * Rotating a session the caller already holds for the same account (password
 * change, 2-step disable/setup) is not a new sign-in and is allowed — refusing
 * it would leave those endpoints half-applied.
 */
export async function refuseStaffSession(
  db: StaffSignInDb,
  input: { userId: string; path: string | undefined; currentSessionUserId: string | undefined },
): Promise<Refusal | null> {
  if (input.path && STAFF_SESSION_PATHS.includes(input.path)) return null;
  if (input.currentSessionUserId && input.currentSessionUserId === input.userId) return null;
  const staff = await findStaffById(db, input.userId);
  return staff ? { status: 403, body: { code: 'USE_STAFF_SIGN_IN' } } : null;
}

/**
 * Before `/two-factor/enable`: only staff may turn 2-step on. The mobile app
 * has no code step, so a member who enabled it would lock themselves out.
 * Refuses unless the caller is positively identified as staff — a request
 * whose session could not be resolved is refused too, never waved through.
 */
export async function refuseTwoFactorEnable(
  db: StaffSignInDb,
  userId: string | undefined,
): Promise<Refusal | null> {
  if (!userId) return NOT_STAFF;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, platformRole: true },
  });
  if (user && isStaffAccount(user)) return null;
  return NOT_STAFF;
}

const NOT_STAFF: Refusal = { status: 403, body: { code: 'NOT_STAFF' } };

/**
 * The twoFactor plugin adds `twoFactorEnabled` to Better Auth's user output.
 * Strip it from the sign-in body so that response stays exactly what clients
 * (the mobile app included) received before the plugin existed.
 */
export function withoutTwoFactorFlag<T>(body: T): T {
  if (!body || typeof body !== 'object' || !('user' in body)) return body;
  const user = (body as { user: unknown }).user;
  if (!user || typeof user !== 'object' || !('twoFactorEnabled' in user)) return body;
  const { twoFactorEnabled: _flag, ...rest } = user as Record<string, unknown>;
  return { ...body, user: rest };
}
