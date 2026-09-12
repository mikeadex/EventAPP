#!/usr/bin/env node
/**
 * Keep one demo church — the one the current review account owns — and remove
 * the others.
 *
 * Each time a review account is recreated it takes the next free slug
 * (demo-church, demo-church-2, ...), leaving the previous one orphaned: nobody
 * has its password, but it is still published. Two identically named churches
 * running identically named events look like duplicate listings to anyone
 * browsing, reviewers included.
 *
 * Usage — reports without changing anything:
 *
 *   DATABASE_URL='<neon production url>' REVIEW_EMAIL=review@ekklesiaevents.com \
 *     pnpm --filter @ekklesia/api prune-demo-churches
 *
 * Add --delete once the report looks right.
 */

import { PrismaClient } from '@prisma/client';

const REVIEW_EMAIL = process.env.REVIEW_EMAIL;
const PREFIX = process.env.DEMO_SLUG_PREFIX ?? 'demo-church';
const doDelete = process.argv.includes('--delete');

if (!REVIEW_EMAIL) {
  console.error('Set REVIEW_EMAIL to the account whose demo church should be kept.');
  process.exit(1);
}
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
  /* the warning below still applies */
}
console.log(`Database: ${host}${/localhost|127\.0\.0\.1/.test(host) ? '  (LOCAL)' : ''}`);
console.log(`Keeping the demo church owned by: ${REVIEW_EMAIL}`);
console.log(doDelete ? 'Mode:     DELETE\n' : 'Mode:     report only (pass --delete to apply)\n');

const prisma = new PrismaClient();

try {
  const keeper = await prisma.user.findUnique({
    where: { email: REVIEW_EMAIL },
    select: { id: true, memberships: { select: { organizationId: true } } },
  });
  if (!keeper) {
    console.error(`No account for ${REVIEW_EMAIL} on this database. Nothing was changed.`);
    process.exit(1);
  }
  const keepIds = new Set(keeper.memberships.map((m) => m.organizationId));

  const demos = await prisma.organization.findMany({
    where: { slug: { startsWith: PREFIX } },
    select: { id: true, name: true, slug: true },
  });

  const doomed = demos.filter((o) => !keepIds.has(o.id));
  const kept = demos.filter((o) => keepIds.has(o.id));

  for (const o of kept) console.log(`  keep    ${o.slug}  (${o.name})`);
  if (!doomed.length) {
    console.log('\nNothing else to remove.');
    process.exit(0);
  }

  // Counted before anything is touched, so the report says what is at stake.
  for (const o of doomed) {
    const events = await prisma.event.findMany({
      where: { organizationId: o.id },
      select: { id: true, title: true, status: true },
    });
    const tickets = events.length
      ? await prisma.ticket.count({ where: { eventId: { in: events.map((e) => e.id) } } })
      : 0;
    console.log(
      `  REMOVE  ${o.slug}  (${o.name}) — ${events.length} event(s), ${tickets} ticket(s)`,
    );
    for (const e of events) console.log(`            · ${e.title} [${e.status}]`);
    if (tickets > 0) {
      console.log(
        `            ! ${tickets} ticket(s) belong to real people and would be deleted too.`,
      );
    }
  }

  if (!doDelete) {
    console.log('\nNothing was changed. Re-run with --delete to apply.');
    process.exit(0);
  }

  for (const o of doomed) {
    const events = await prisma.event.findMany({
      where: { organizationId: o.id },
      select: { id: true },
    });
    const ids = events.map((e) => e.id);
    await prisma.$transaction(async (tx) => {
      if (ids.length) {
        await tx.ticket.deleteMany({ where: { eventId: { in: ids } } });
        await tx.eventMedia.deleteMany({ where: { eventId: { in: ids } } });
        await tx.savedEvent.deleteMany({ where: { eventId: { in: ids } } });
        await tx.report.updateMany({
          where: { targetEventId: { in: ids } },
          data: { targetEventId: null },
        });
        await tx.event.deleteMany({ where: { id: { in: ids } } });
      }
      await tx.report.updateMany({ where: { targetOrgId: o.id }, data: { targetOrgId: null } });
      await tx.block.deleteMany({ where: { blockedOrgId: o.id } });
      await tx.organizationMembership.deleteMany({ where: { organizationId: o.id } });
      await tx.organization.delete({ where: { id: o.id } });
    });
    console.log(`✓ removed ${o.slug}`);
  }
} finally {
  await prisma.$disconnect();
}
