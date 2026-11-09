#!/usr/bin/env node
/**
 * Why can this person not sign in?
 *
 * "I signed up but I'm stuck" has several different causes that look identical
 * from the outside — no verification email sent, one sent but never delivered,
 * a social account that never needed one, or an account that was created
 * against a different environment entirely and so does not exist here at all.
 * Reading the row settles it in one go.
 *
 * Nothing here writes, and no password hash or token value is printed — only
 * whether one exists.
 *
 *   DATABASE_URL='<neon production url>' EMAIL='someone@example.com' \
 *     pnpm --filter @ekklesia/api check-account
 */

import { PrismaClient } from '@prisma/client';

/**
 * Strip quoting the shell did not. A smart-quoting terminal turns EMAIL='x'
 * into ‘x — the curly quote becomes part of the value, the lookup silently
 * matches nothing, and the script confidently reports that the account does
 * not exist. That false negative costs far more than this line does.
 */
const unquote = (s) =>
  s
    ?.trim()
    .replace(/^[\s'"`‘’“”]+/, '')
    .replace(/[\s'"`‘’“”]+$/, '')
    .trim();

const emailRaw = process.env.EMAIL;
const email = unquote(emailRaw)?.toLowerCase();
const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
if (!email) {
  console.error("EMAIL is not set. Pass the address you signed up with, e.g. EMAIL=you@example.com");
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  // Refuse rather than search: "no such account" is a dangerous thing to
  // report when the address was never well formed in the first place.
  console.error(`EMAIL does not look like an address: ${JSON.stringify(email)}`);
  if (emailRaw !== email) console.error(`(received ${JSON.stringify(emailRaw)}, stripped to the above)`);
  console.error('Check for stray quotes — some terminals substitute curly ones.');
  process.exit(1);
}
if (emailRaw?.trim() !== email) {
  console.log(`Note: cleaned ${JSON.stringify(emailRaw)} -> ${JSON.stringify(email)}\n`);
}
let host = 'unparseable';
try {
  const u = new URL(raw);
  host = `${u.hostname}${u.pathname}`;
} catch {
  /* the local warning below still applies */
}
console.log(`Database: ${host}${/localhost|127\.0\.0\.1/.test(host) ? '  (LOCAL)' : ''}`);
console.log('Mode:     read only\n');

const prisma = new PrismaClient();
const iso = (d) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '—');

try {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, name: true, emailVerified: true, createdAt: true, image: true },
  });

  if (!user) {
    console.log(`No account with ${email} exists in THIS database.`);
    console.log('\nThat usually means the signup went somewhere else — a build still');
    console.log('pointing at a LAN address or a preview deployment rather than');
    console.log('production. Check EXPO_PUBLIC_API_URL in the build they are using.');
    process.exit(0);
  }

  console.log(`${user.name ?? '(no name)'}   <${user.email}>`);
  console.log(`  created        ${iso(user.createdAt)}`);
  console.log(`  email verified ${user.emailVerified ? 'YES' : 'NO'}`);
  console.log(`  has picture    ${user.image ? 'yes' : 'no'}`);

  // ── how they signed up ────────────────────────────────────────────────────
  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    select: { providerId: true, password: true, createdAt: true },
  });
  console.log(`\n  Sign-in methods (${accounts.length}):`);
  if (!accounts.length) {
    console.log('    NONE — the user row exists with no way to authenticate.');
  }
  for (const a of accounts) {
    const kind = a.providerId === 'credential' ? 'email + password' : a.providerId;
    console.log(`    ${kind.padEnd(18)} password set: ${a.password ? 'yes' : 'no'}   added ${iso(a.createdAt)}`);
  }
  const hasCredential = accounts.some((a) => a.providerId === 'credential');
  const social = accounts.filter((a) => a.providerId !== 'credential').map((a) => a.providerId);

  // ── pending verification ──────────────────────────────────────────────────
  const pending = await prisma.verification.findMany({
    where: { identifier: { contains: user.email, mode: 'insensitive' } },
    select: { identifier: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(`\n  Verification tokens issued (${pending.length}):`);
  if (!pending.length) console.log('    none — no verification email was ever generated for this address');
  for (const v of pending) {
    const live = v.expiresAt > new Date();
    console.log(`    issued ${iso(v.createdAt)}   expires ${iso(v.expiresAt)}  ${live ? '(still valid)' : '(expired)'}`);
  }

  // ── sessions ──────────────────────────────────────────────────────────────
  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    select: { createdAt: true, expiresAt: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  const liveSessions = sessions.filter((s) => s.expiresAt > new Date()).length;
  console.log(`\n  Sessions: ${sessions.length} recent, ${liveSessions} still valid`);
  for (const s of sessions) console.log(`    ${iso(s.createdAt)} -> ${iso(s.expiresAt)}`);

  // ── the verdict ───────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(72));
  if (user.emailVerified) {
    console.log('Can sign in: YES — verified. A failure now is not a verification problem.');
  } else if (social.length && !hasCredential) {
    console.log(`Can sign in: via ${social.join(', ')} only — there is no password on this account.`);
    console.log('Signing in with email and password will fail, and no verification');
    console.log('email is ever sent for a social account because the provider asserts');
    console.log('the address. Use the social button instead.');
  } else if (hasCredential && !pending.length) {
    console.log('Can sign in: NO — unverified, and NO verification token was ever issued.');
    console.log('The signup never reached the code that sends the email. Check whether');
    console.log('this account was created against this environment at all.');
  } else {
    console.log('Can sign in: NO — unverified, but a token WAS issued, so the API did');
    console.log('try to send. The failure is in delivery: check the Resend dashboard');
    console.log('for this address, and the spam folder.');
  }
} finally {
  await prisma.$disconnect();
}
