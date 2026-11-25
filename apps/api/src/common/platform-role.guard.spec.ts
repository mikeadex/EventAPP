import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { afterTwoFactorEnrolled, type StaffSignInDb } from '../modules/auth/staff-signin.js';
import { PlatformRoleGuard } from './platform-role.guard.js';

/**
 * The admin guard reads `twoFactorEnabled` from the account, not the session,
 * so a session made before 2-step setup would pass it afterwards unless setup
 * ends that session. This walks the whole sequence against one fake store.
 */
type Session = { id: string; userId: string; token: string };

function world() {
  const user = {
    id: 'u_staff',
    email: 'ada@ekklesiaevents.com',
    platformRole: 'PLATFORM_MODERATOR',
    twoFactorEnabled: false,
    deletedAt: null as Date | null,
    failedSignIns: 0,
    lockedUntil: null as Date | null,
  };
  let sessions: Session[] = [];

  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === user.id ? { ...user } : null,
      ),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    session: {
      deleteMany: jest.fn(async ({ where }: { where: { userId: string; id?: { not: string } } }) => {
        const before = sessions.length;
        sessions = sessions.filter(
          (s) => !(s.userId === where.userId && (!where.id || s.id !== where.id.not)),
        );
        return { count: before - sessions.length };
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  };

  // Stands in for Better Auth's getSession: a token resolves only while its
  // session row exists, whether it came as a cookie or a mobile bearer token.
  const currentUser = {
    fromRequest: jest.fn(async (req: { headers: Record<string, string> }) => {
      const token = req.headers.authorization?.replace(/^Bearer /, '');
      const s = sessions.find((x) => x.token === token);
      return s ? { id: user.id, email: user.email, platformRole: 'USER' } : null;
    }),
  };

  const reflector = { getAllAndOverride: () => 'PLATFORM_SUPPORT' } as unknown as Reflector;
  const guard = new PlatformRoleGuard(reflector, currentUser as never, prisma as never);
  const ctxFor = (token: string) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  return {
    user,
    prisma,
    asDb: prisma as unknown as StaffSignInDb,
    addSession: (s: Session) => sessions.push(s),
    removeSession: (id: string) => (sessions = sessions.filter((s) => s.id !== id)),
    guard,
    check: (token: string) => guard.canActivate(ctxFor(token)),
  };
}

describe('PlatformRoleGuard after 2-step setup', () => {
  it('a session from before setup (mobile bearer) is gone afterwards; the new one passes', async () => {
    const w = world();
    w.addSession({ id: 's_mobile', userId: w.user.id, token: 'bearer-before-setup' });
    w.addSession({ id: 's_setup', userId: w.user.id, token: 'cookie-used-for-setup' });

    // Before setup the console is closed to every session of the account.
    await expect(w.check('bearer-before-setup')).rejects.toBeInstanceOf(ForbiddenException);

    // verify-totp during setup: Better Auth turns 2-step on, issues a new
    // session and deletes only the one the request came with…
    w.user.twoFactorEnabled = true;
    w.addSession({ id: 's_new', userId: w.user.id, token: 'issued-by-verify-totp' });
    w.removeSession('s_setup');
    // Without the after-hook the old bearer token would now pass the guard.
    await expect(w.check('bearer-before-setup')).resolves.toBe(true);
    // …and the after-hook ends the rest.
    await afterTwoFactorEnrolled(w.asDb, w.user, 's_new', undefined);

    await expect(w.check('bearer-before-setup')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(w.check('issued-by-verify-totp')).resolves.toBe(true);
  });
});
