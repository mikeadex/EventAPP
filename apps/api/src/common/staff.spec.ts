import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { isStaffEmail, staffBlockReason } from './staff.js';
import { PlatformRoleGuard } from './platform-role.guard.js';

describe('isStaffEmail', () => {
  it('accepts the staff domain in any case', () => {
    expect(isStaffEmail('David@EkklesiaEvents.com')).toBe(true);
  });
  it('rejects lookalike and sub-domains', () => {
    expect(isStaffEmail('a@ekklesiaevents.com.evil.io')).toBe(false);
    expect(isStaffEmail('a@sub.ekklesiaevents.com')).toBe(false);
  });
});

describe('staffBlockReason', () => {
  const ok = { email: 'x@ekklesiaevents.com', platformRole: 'PLATFORM_ADMIN', twoFactorEnabled: true };
  it('is null for a staff-domain role holder with 2-step', () => {
    expect(staffBlockReason(ok)).toBeNull();
  });
  it('flags an off-domain role holder', () => {
    expect(staffBlockReason({ ...ok, email: 'x@gmail.com' })).toBe('WRONG_DOMAIN');
  });
  it('flags a plain USER', () => {
    expect(staffBlockReason({ ...ok, platformRole: 'USER' })).toBe('NOT_STAFF');
  });
  it('flags missing 2-step', () => {
    expect(staffBlockReason({ ...ok, twoFactorEnabled: false })).toBe('NEEDS_2FA');
  });
});

describe('PlatformRoleGuard', () => {
  function run(row: Record<string, unknown>, required = 'PLATFORM_SUPPORT') {
    const reflector = { getAllAndOverride: () => required } as unknown as Reflector;
    const currentUser = { fromRequest: async () => ({ id: 'u1' }) };
    const prisma = { user: { findUnique: async () => ({ deletedAt: null, ...row }) } };
    const guard = new PlatformRoleGuard(reflector, currentUser as never, prisma as never);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    } as unknown as ExecutionContext;
    return guard.canActivate(ctx);
  }
  const staff = { email: 'a@ekklesiaevents.com', twoFactorEnabled: true };

  it('lets a staff moderator through a support gate', async () => {
    await expect(run({ ...staff, platformRole: 'PLATFORM_MODERATOR' })).resolves.toBe(true);
  });
  it('refuses PLATFORM_FINANCE on a PLATFORM_SUPPORT gate', async () => {
    await expect(run({ ...staff, platformRole: 'PLATFORM_FINANCE' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('refuses with the block reason code', async () => {
    await expect(
      run({ ...staff, email: 'a@gmail.com', platformRole: 'PLATFORM_ADMIN' }),
    ).rejects.toMatchObject({ response: { code: 'WRONG_DOMAIN' } });
    await expect(
      run({ ...staff, twoFactorEnabled: false, platformRole: 'PLATFORM_ADMIN' }),
    ).rejects.toMatchObject({ response: { code: 'NEEDS_2FA' } });
  });
});
