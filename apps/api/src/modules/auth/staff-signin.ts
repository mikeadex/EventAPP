import type { Prisma, PrismaClient } from '@prisma/client';
import { isStaffEmail } from '../../common/staff.js';

/**
 * Staff sign-in protection, applied from Better Auth hooks in auth.ts.
 *
 * Everything here acts only on staff accounts — a platform role *and* an
 * address on the staff domain. For anyone else every function is a no-op, so
 * the mobile app's sign-in (same endpoint, bearer tokens) is untouched.
 *
 * Kept free of Better Auth imports: better-auth is ESM-only and this API is
 * CommonJS, so auth.ts turns a `Refusal` into Better Auth's APIError.
 */

export const MAX_FAILED_SIGN_INS = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000;

/** The slice of Prisma these hooks use, so tests can hand in a mock. */
export type StaffSignInDb = {
  user: Pick<PrismaClient['user'], 'findUnique' | 'update'>;
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
} satisfies Prisma.UserSelect;

type StaffRow = Prisma.UserGetPayload<{ select: typeof staffSelect }>;

async function findStaff(db: StaffSignInDb, email: string): Promise<StaffRow | null> {
  const user = (await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: staffSelect,
  })) as StaffRow | null;
  return user && isStaffAccount(user) ? user : null;
}

function isLocked(user: StaffRow, now: Date): user is StaffRow & { lockedUntil: Date } {
  return user.lockedUntil !== null && user.lockedUntil > now;
}

async function applyAttempt(
  db: StaffSignInDb,
  user: StaffRow,
  ok: boolean,
  now: Date,
): Promise<{ locked: boolean; lockedUntil: Date | null; failedSignIns: number }> {
  if (ok) {
    await db.user.update({
      where: { id: user.id },
      data: { failedSignIns: 0, lockedUntil: null },
    });
    return { locked: false, lockedUntil: null, failedSignIns: 0 };
  }
  // Still locked: the before-hook normally refuses first, but never extend a lock.
  if (isLocked(user, now)) {
    return { locked: true, lockedUntil: user.lockedUntil, failedSignIns: user.failedSignIns };
  }
  // A lock that has run out starts a fresh count of attempts.
  const failedSignIns = (user.lockedUntil ? 0 : user.failedSignIns) + 1;
  const lockedUntil =
    failedSignIns >= MAX_FAILED_SIGN_INS ? new Date(now.getTime() + LOCK_DURATION_MS) : null;
  await db.user.update({ where: { id: user.id }, data: { failedSignIns, lockedUntil } });
  return { locked: lockedUntil !== null, lockedUntil, failedSignIns };
}

/**
 * Count a staff sign-in attempt: success clears the counter, the 5th
 * consecutive failure locks the account for 15 minutes. Non-staff: no-op.
 */
export async function recordSignInAttempt(
  db: StaffSignInDb,
  email: string,
  ok: boolean,
  now: Date,
): Promise<{ locked: boolean; lockedUntil: Date | null }> {
  const user = await findStaff(db, email);
  if (!user) return { locked: false, lockedUntil: null };
  const { locked, lockedUntil } = await applyAttempt(db, user, ok, now);
  return { locked, lockedUntil };
}

/** Same extraction as AuditLogService, from the fetch Headers Better Auth hands hooks. */
function requestMeta(headers: Headers | undefined) {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim();
  return {
    ipAddress: forwarded || headers?.get('x-real-ip') || undefined,
    userAgent: headers?.get('user-agent') ?? undefined,
  };
}

async function audit(
  db: StaffSignInDb,
  user: StaffRow,
  action: 'staff.signin' | 'staff.signin.failed',
  headers: Headers | undefined,
  metadata?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({
    data: {
      actorUserId: user.id,
      action,
      targetType: 'User',
      targetId: user.id,
      metadata,
      ...requestMeta(headers),
    },
  });
}

/** Before `/sign-in/email`: a locked staff account gets 423 and the attempt is audited. */
export async function refuseLockedSignIn(
  db: StaffSignInDb,
  email: unknown,
  headers: Headers | undefined,
  now: Date,
): Promise<Refusal | null> {
  if (typeof email !== 'string' || !email) return null;
  const user = await findStaff(db, email);
  if (!user || !isLocked(user, now)) return null;
  await audit(db, user, 'staff.signin.failed', headers, { reason: 'locked' });
  return { status: 423, body: { code: 'LOCKED', lockedUntil: user.lockedUntil.toISOString() } };
}

/** After `/sign-in/email`: count the attempt and audit it, for staff only. */
export async function afterSignIn(
  db: StaffSignInDb,
  input: {
    email: unknown;
    outcome: SignInOutcome;
    headers: Headers | undefined;
    now: Date;
    /** Password accepted but the 2-step code is still to come. */
    twoFactorPending?: boolean;
  },
): Promise<void> {
  const { email, outcome, headers, now } = input;
  if (outcome === 'other' || typeof email !== 'string' || !email) return;
  const user = await findStaff(db, email);
  if (!user) return;
  const result = await applyAttempt(db, user, outcome === 'ok', now);
  if (outcome === 'ok') {
    await audit(db, user, 'staff.signin', headers, {
      twoFactorPending: input.twoFactorPending ?? false,
    });
  } else {
    await audit(db, user, 'staff.signin.failed', headers, {
      reason: 'bad_credentials',
      failedSignIns: result.failedSignIns,
      lockedUntil: result.lockedUntil?.toISOString() ?? null,
    });
  }
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
