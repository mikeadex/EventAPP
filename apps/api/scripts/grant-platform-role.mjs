#!/usr/bin/env node
/**
 * Grants (or revokes) a platform role on an existing account.
 *
 * The seed only creates a platform admin outside production, so on Neon every
 * account is USER and nobody can open the moderation queue. This is how the
 * first one is made, and how moderators are added later.
 *
 * Usage — run it from the repo root with the production connection string in
 * the environment, never committed:
 *
 *   DATABASE_URL='postgresql://...' \
 *   node apps/api/scripts/grant-platform-role.mjs david@ekklesiaevents.com
 *
 *   DATABASE_URL='postgresql://...' \
 *   node apps/api/scripts/grant-platform-role.mjs sam@example.com PLATFORM_MODERATOR
 *
 * The account must already exist — sign up through the app first. This script
 * deliberately cannot create one: an admin account made outside the normal
 * signup flow has no password, no verified email and no audit trail.
 *
 * Pass --dry-run to see what would change without writing.
 */

import { PrismaClient } from '@prisma/client';

const ROLES = ['USER', 'PLATFORM_SUPPORT', 'PLATFORM_MODERATOR', 'PLATFORM_ADMIN'];

const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
const dryRun = process.argv.includes('--dry-run');
const [email, role = 'PLATFORM_ADMIN'] = args;

if (!email) {
  console.error('Usage: node apps/api/scripts/grant-platform-role.mjs <email> [role]');
  console.error(`Roles: ${ROLES.join(', ')}  (default PLATFORM_ADMIN)`);
  process.exit(1);
}
if (!ROLES.includes(role)) {
  console.error(`Unknown role "${role}". One of: ${ROLES.join(', ')}`);
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
console.log(`Account:  ${email}`);
console.log(`Role:     ${role}${dryRun ? '  (dry run)' : ''}\n`);

const prisma = new PrismaClient();

try {
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
    console.log(`Would change ${user.platformRole} -> ${role}.`);
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { platformRole: role } });
    // Written by hand rather than through AuditLogService: this runs outside
    // Nest, and a role change is exactly the kind of thing that should be
    // answerable later.
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'user.platform_role.grant',
        targetType: 'user',
        targetId: user.id,
        metadata: { from: user.platformRole, to: role, via: 'grant-platform-role script' },
      },
    });
    console.log(`Done. ${user.email} is now ${role} (was ${user.platformRole}).`);
    if (!user.emailVerified) {
      console.log(`Note: this account's email is not verified.`);
    }
  }
} finally {
  await prisma.$disconnect();
}
