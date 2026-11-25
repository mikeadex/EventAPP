#!/usr/bin/env node
/**
 * Grants (or revokes) a platform role on an existing account.
 *
 * The seed only creates a platform admin outside production, so on Neon every
 * account is USER and nobody can open the moderation queue. This is how the
 * first one is made, and how moderators are added later.
 *
 * Usage — with the production connection string in the environment, never
 * committed. Works from any directory in the repo:
 *
 *   DATABASE_URL='postgresql://...' \
 *   pnpm --filter @ekklesia/api grant-role -- david@ekklesiaevents.com
 *
 *   DATABASE_URL='postgresql://...' \
 *   pnpm --filter @ekklesia/api grant-role -- sam@example.com PLATFORM_MODERATOR
 *
 * The account must already exist — sign up through the app first. This script
 * deliberately cannot create one: an admin account made outside the normal
 * signup flow has no password, no verified email and no audit trail.
 *
 * Pass --dry-run to see what would change without writing.
 * Pass --list-offdomain to list staff-role accounts outside @ekklesiaevents.com
 * (changes nothing).
 * Any non-USER role is refused for an address outside @ekklesiaevents.com.
 * Changing a role signs the account out everywhere (see platform-role-change.cjs).
 */

import { PrismaClient } from '@prisma/client';
import roleChange from './platform-role-change.cjs';

const { changePlatformRole } = roleChange;

const ROLES = ['USER', 'PLATFORM_SUPPORT', 'PLATFORM_MODERATOR', 'PLATFORM_ADMIN', 'PLATFORM_FINANCE'];
// Keep in step with apps/api/src/common/staff.ts (STAFF_DOMAIN, isStaffEmail).
const STAFF_DOMAIN = 'ekklesiaevents.com';
const isStaffEmail = (e) => e.trim().toLowerCase().endsWith(`@${STAFF_DOMAIN}`);

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const listOffDomain = argv.includes('--list-offdomain');
// Anything dash-prefixed is a flag, never a positional. `pnpm run x -- foo`
// forwards the bare `--` too, which would otherwise be read as the email.
const [email, role = 'PLATFORM_ADMIN'] = argv.filter((a) => !a.startsWith('-'));

if (!email && !listOffDomain) {
  console.error('Usage: pnpm --filter @ekklesia/api grant-role -- <email> [role]');
  console.error(`Roles: ${ROLES.join(', ')}  (default PLATFORM_ADMIN)`);
  process.exit(1);
}
if (email && !ROLES.includes(role)) {
  console.error(`Unknown role "${role}". One of: ${ROLES.join(', ')}`);
  process.exit(1);
}

if (email && role !== 'USER' && !isStaffEmail(email)) {
  console.error(`Staff roles are only for @${STAFF_DOMAIN} addresses.`);
  process.exit(1);
}

// Say which database is about to be written to, with the credentials stripped.
// Running a production grant against localhost — or the reverse — is the
// mistake this line exists to prevent.
const raw = process.env.DATABASE_URL ?? '';
if (!raw) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
let host = 'unparseable';
try {
  const u = new URL(raw);
  host = `${u.hostname}${u.pathname}`;
} catch {
  /* leave as unparseable — the warning below still applies */
}
const looksLocal = /localhost|127\.0\.0\.1/.test(host);
console.log(`Database: ${host}${looksLocal ? '  (LOCAL — not production)' : ''}`);
if (email) {
  console.log(`Account:  ${email}`);
  console.log(`Role:     ${role}${dryRun ? '  (dry run)' : ''}\n`);
}

const prisma = new PrismaClient();

try {
  if (listOffDomain) {
    const rows = await prisma.user.findMany({
      where: { platformRole: { not: 'USER' } },
      select: { email: true, platformRole: true },
    });
    const off = rows.filter((r) => !isStaffEmail(r.email));
    console.log(off.length ? 'Staff-role accounts outside the staff domain:' : 'None outside the staff domain.');
    for (const r of off) console.log(`  ${r.email}  ${r.platformRole}`);
  } else {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, platformRole: true, emailVerified: true },
    });

    if (!user) {
      console.error(`No account with that email on this database.`);
      console.error(`Sign up at the website or in the app first, then re-run this.`);
      process.exitCode = 1;
    } else if (user.platformRole === role) {
      console.log(`Already ${role}. Nothing to do.`);
    } else if (dryRun) {
      console.log(`Would change ${user.platformRole} -> ${role} and end their sessions.`);
    } else {
      const { sessionsEnded } = await changePlatformRole(
        prisma,
        user,
        role,
        'grant-platform-role script',
      );
      console.log(`Done. ${user.email} is now ${role} (was ${user.platformRole}).`);
      console.log(`Signed out of ${sessionsEnded} session(s); they sign in again to pick it up.`);
      if (!user.emailVerified) {
        console.log(`Note: this account's email is not verified.`);
      }
    }
  }
} finally {
  await prisma.$disconnect();
}
