#!/usr/bin/env node
/**
 * List every organisation on the platform with enough context to decide which
 * are real and which are seed data — before anything is unpublished or deleted.
 *
 * This exists because "clean up the demo data" is a destructive instruction
 * given against a guess. Four of the five organisations currently live look
 * like seed data and one looks like a real church that signed up; a regex over
 * names like /demo|test/ would spare that one today and quietly catch the next
 * real organisation that happens to be called "Test Valley Community Church".
 * So this classifies nothing. It prints what is there and who would notice if
 * it went away, and a human decides.
 *
 * The number that matters is the last column: tickets held by people who are
 * not members of the organisation. Unpublishing an event hides it; deleting one
 * cascades to its tickets, so a non-zero count there means a real person loses
 * a booking they can still see in the app.
 *
 * Usage — this script never writes:
 *
 *   DATABASE_URL='<neon production url>' pnpm --filter @ekklesia/api audit-content
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

try {
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      verificationStatus: true,
      createdAt: true,
      // Every membership, not only OWNER. An orphaned organisation has no
      // owner at all, which would make every ticket on it look like an
      // outsider's and inflate the number this script exists to report.
      memberships: {
        select: { role: true, user: { select: { id: true, email: true } } },
      },
      events: {
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          startsAt: true,
          coverImageUrl: true,
          tickets: {
            select: {
              status: true,
              attendeeEmail: true,
              user: { select: { id: true, email: true } },
            },
          },
        },
      },
    },
  });

  if (!orgs.length) {
    console.log('No organisations found.');
    process.exit(0);
  }

  const now = new Date();
  const iso = (d) => d.toISOString().replace('T', ' ').slice(0, 16);
  const byName = new Map();
  /** email -> how many tickets that person holds, across every organisation */
  const holders = new Map();

  for (const org of orgs) {
    byName.set(org.name, [...(byName.get(org.name) ?? []), org.slug]);
    const owners = org.memberships.filter((m) => m.role === 'OWNER').map((m) => m.user);
    const insiderIds = new Set(org.memberships.map((m) => m.user.id));
    const published = org.events.filter((e) => e.status === 'PUBLISHED');
    const upcoming = published.filter((e) => e.startsAt > now);

    console.log(`${org.name}`);
    console.log(`  slug        ${org.slug}`);
    console.log(`  kind        ${org.kind}   verification ${org.verificationStatus}`);
    console.log(`  created     ${iso(org.createdAt)}`);
    console.log(
      `  owner(s)    ${owners.length ? owners.map((u) => u.email).join(', ') : '(none — orphaned)'}`,
    );
    console.log(
      `  events      ${org.events.length} total, ${published.length} published, ${upcoming.length} still upcoming`,
    );

    if (org.events.length) {
      console.log('');
      for (const e of org.events) {
        const live = e.tickets.filter((t) => t.status !== 'CANCELLED');
        // Who actually holds a ticket matters more than how many do. One name
        // tells you whether this is your own test account or somebody who
        // found the app and booked a place.
        const whoCount = new Map();
        for (const t of live) {
          const who = t.user?.email ?? t.attendeeEmail ?? '(no email on ticket)';
          whoCount.set(who, (whoCount.get(who) ?? 0) + 1);
          holders.set(who, (holders.get(who) ?? 0) + 1);
        }
        const outsiders = live.filter((t) => !t.user || !insiderIds.has(t.user.id));
        const who = [...whoCount]
          .map(([email, n]) => (n > 1 ? `${email} ×${n}` : email))
          .join(', ');
        const when = e.startsAt > now ? iso(e.startsAt) : `${iso(e.startsAt)} (past)`;
        const flags = [
          e.status !== 'PUBLISHED' ? e.status : null,
          e.visibility !== 'PUBLIC' ? e.visibility : null,
          e.coverImageUrl ? null : 'no cover image',
          live.length
            ? `${live.length} ticket(s)${outsiders.length ? '' : ', all held by members'}: ${who}`
            : null,
        ].filter(Boolean);
        console.log(
          `    ${when}  ${e.title.slice(0, 32).padEnd(34)}${flags.length ? flags.join(' · ') : ''}`,
        );
      }
    }
    console.log('');
  }

  console.log('─'.repeat(72));
  console.log(`${orgs.length} organisation(s).\n`);

  const dupes = [...byName].filter(([, slugs]) => slugs.length > 1);
  if (dupes.length) {
    console.log('Duplicate organisation names — these look like repeats to anyone browsing:');
    for (const [name, slugs] of dupes) console.log(`  "${name}"  ->  ${slugs.join(', ')}`);
    console.log('');
  }

  if (holders.size) {
    console.log('Everyone currently holding a ticket to anything, most tickets first:');
    for (const [email, n] of [...holders].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}  ${email}`);
    }
    console.log(`
Check that list before deleting anything. Deleting an event cascades to its
tickets, so any name there that is not one of your own test accounts is a
person who loses a booking they can still see in the app. Unpublishing
(status DRAFT) or unlisting (visibility UNLISTED) hides the event from
discovery and leaves the ticket intact.`);
  } else {
    console.log('Nobody holds a ticket to anything.');
  }
} finally {
  await prisma.$disconnect();
}
