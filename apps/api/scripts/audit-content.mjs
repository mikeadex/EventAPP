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
      memberships: {
        where: { role: 'OWNER' },
        select: { user: { select: { id: true, email: true } } },
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
          tickets: { select: { userId: true, status: true } },
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
  let totalOutsideTickets = 0;

  for (const org of orgs) {
    const owners = org.memberships.map((m) => m.user);
    const ownerIds = new Set(owners.map((u) => u.id));
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
        // A ticket held by someone who does not run the organisation is a real
        // booking by a real person, whatever we think of the event.
        const live = e.tickets.filter((t) => t.status !== 'CANCELLED');
        const outside = live.filter((t) => t.userId && !ownerIds.has(t.userId));
        totalOutsideTickets += outside.length;
        const when = e.startsAt > now ? iso(e.startsAt) : `${iso(e.startsAt)} (past)`;
        const flags = [
          e.status !== 'PUBLISHED' ? e.status : null,
          e.visibility !== 'PUBLIC' ? e.visibility : null,
          e.coverImageUrl ? null : 'no cover image',
          outside.length ? `⚠ ${outside.length} ticket(s) held by non-members` : null,
          !outside.length && live.length ? `${live.length} ticket(s), all internal` : null,
        ].filter(Boolean);
        console.log(
          `    ${when}  ${e.title.slice(0, 32).padEnd(34)}${flags.length ? flags.join(' · ') : ''}`,
        );
      }
    }
    console.log('');
  }

  console.log('─'.repeat(72));
  console.log(`${orgs.length} organisation(s).`);
  if (totalOutsideTickets) {
    console.log(
      `\n⚠ ${totalOutsideTickets} ticket(s) are held by people who do not run the
  organisation that issued them. Deleting those events cascades to the tickets
  and those people lose a booking that is currently in their app. Unpublish
  (status DRAFT) or unlist (visibility UNLISTED) instead — both hide the event
  from discovery while leaving the ticket intact.`,
    );
  } else {
    console.log('\nNo tickets are held by anyone outside the issuing organisation.');
  }
} finally {
  await prisma.$disconnect();
}
