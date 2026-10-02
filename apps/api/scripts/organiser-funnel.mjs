#!/usr/bin/env node
/**
 * Where organisers stop.
 *
 * Four real organisations have signed up and three of them published nothing.
 * Nothing in the code explains it — the route from the profile into the
 * organiser area is clear, the empty state has a "Create event" button,
 * publishing requires no cover image and no verification — so the answer has to
 * come from what people actually did, not from reading the screens again.
 *
 * It already exists. AuditLog records organization.create, event.create,
 * event.update and event.publish with a timestamp and an actor, which is the
 * whole funnel. This reads it back.
 *
 * The column worth looking at first is `email verified`. Verification is
 * enforced for email/password sign-in, so an owner who mistyped their address
 * cannot receive the mail, cannot verify, and cannot get back in — and there is
 * no screen anywhere that tells them that. One of the live accounts is
 * `hey@gmail.con`.
 *
 * Usage — this script never writes:
 *
 *   DATABASE_URL='<neon production url>' pnpm --filter @ekklesia/api organiser-funnel
 */

import { PrismaClient } from '@prisma/client';

const raw = process.env.DATABASE_URL;
if (!raw) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
let host = 'unparseable';
try {
  const u = new URL(raw);
  host = `${u.hostname}${u.pathname}`;
} catch {
  /* the local warning below still applies */
}
console.log(`Database: ${host}${/localhost|127\.0\.0\.1/.test(host) ? '  (LOCAL)' : ''}`);
console.log('Mode:     read only — this script has no write path\n');

const prisma = new PrismaClient();

const iso = (d) => d.toISOString().replace('T', ' ').slice(0, 16);
/** "3h", "2d", "14m" — how long after the organisation was created. */
function since(from, to) {
  const mins = Math.round((to - from) / 60000);
  if (mins < 60) return `+${mins}m`;
  if (mins < 60 * 24) return `+${Math.round(mins / 60)}h`;
  return `+${Math.round(mins / (60 * 24))}d`;
}

try {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      isDemo: true,
      createdAt: true,
      verificationStatus: true,
      memberships: {
        where: { role: 'OWNER' },
        select: {
          user: {
            select: { id: true, email: true, emailVerified: true, createdAt: true },
          },
        },
      },
      events: { select: { id: true, status: true } },
    },
  });

  const real = orgs.filter((o) => !o.isDemo && o.memberships.length);
  if (!real.length) {
    console.log('No organisations with an owner. Nothing to measure.');
    process.exit(0);
  }

  const stages = { signedUp: 0, createdOrg: 0, createdEvent: 0, published: 0 };
  const stuck = [];

  for (const org of real) {
    const owner = org.memberships[0].user;
    const log = await prisma.auditLog.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
      select: { action: true, createdAt: true, actorUserId: true },
    });
    // Anything at all this person has done since, organisation or not — it
    // separates "gave up on hosting" from "never came back to the app".
    const lastSeen = await prisma.auditLog.findFirst({
      where: { actorUserId: owner.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, action: true },
    });

    const hasEvent = org.events.length > 0;
    const hasPublished = org.events.some((e) => e.status === 'PUBLISHED');
    stages.signedUp++;
    stages.createdOrg++;
    if (hasEvent) stages.createdEvent++;
    if (hasPublished) stages.published++;

    const verdict = hasPublished
      ? 'published'
      : hasEvent
        ? 'STUCK — created an event, never published it'
        : 'STUCK — created the organisation, never created an event';
    if (!hasPublished) stuck.push({ org, owner, verdict, lastSeen });

    console.log(`${org.name}   (${org.slug})`);
    console.log(`  owner          ${owner.email}`);
    console.log(
      `  email verified ${owner.emailVerified ? 'yes' : 'NO — cannot sign in again, and is never told why'}`,
    );
    console.log(`  signed up      ${iso(owner.createdAt)}`);
    console.log(`  org created    ${iso(org.createdAt)}   (${org.verificationStatus})`);
    console.log(`  outcome        ${verdict}`);
    if (log.length) {
      console.log('  trail');
      for (const row of log) {
        console.log(
          `    ${iso(row.createdAt)}  ${since(org.createdAt, row.createdAt).padStart(5)}  ${row.action}`,
        );
      }
    } else {
      console.log('  trail          (nothing recorded against this organisation)');
    }
    console.log(
      `  last activity  ${lastSeen ? `${iso(lastSeen.createdAt)}  ${lastSeen.action}` : '(none recorded)'}`,
    );
    console.log('');
  }

  console.log('─'.repeat(72));
  console.log('Funnel, real organisations only:\n');
  const bar = (n) => '█'.repeat(n).padEnd(Math.max(stages.signedUp, 1), '·');
  console.log(`  created an organisation   ${bar(stages.createdOrg)}  ${stages.createdOrg}`);
  console.log(`  created an event          ${bar(stages.createdEvent)}  ${stages.createdEvent}`);
  console.log(`  published one             ${bar(stages.published)}  ${stages.published}`);

  if (stuck.length) {
    console.log(`\n${stuck.length} organisation(s) never got an event live:\n`);
    for (const s of stuck) {
      console.log(`  ${s.owner.email.padEnd(34)} ${s.verdict}`);
    }
    const unverified = stuck.filter((s) => !s.owner.emailVerified);
    if (unverified.length) {
      console.log(`
${unverified.length} of them never verified their email address. Verification gates
sign-in, so those accounts are locked out with no way back and no message
explaining it — check their addresses for a typo before concluding they lost
interest. That is a support problem and a signup-validation problem, not a
funnel problem.`);
    }
  }
} finally {
  await prisma.$disconnect();
}
