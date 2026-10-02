#!/usr/bin/env node
/**
 * Mark organisations as demo content, and grant an account permission to see it.
 *
 * Seed organisations are fabricated — a real venue and a real time with nothing
 * actually happening — and they are currently visible to real users on a
 * shipped app. Marking one hides it from the feed, the search and the city
 * picker. It stays reachable by direct link, deliberately: people already hold
 * tickets to some of those events and a ticket has to still open.
 *
 * Nothing here deletes anything, and every change is reversible by running the
 * same command with --unmark.
 *
 * Report the current state, changing nothing:
 *
 *   DATABASE_URL='<neon production url>' pnpm --filter @ekklesia/api demo-content
 *
 * Hide the seed organisations and let the review account still see them:
 *
 *   DATABASE_URL='<neon production url>' \
 *     DEMO_ORGS=love-salvation-church,grace-community,demo-church,demo-church-2 \
 *     DEMO_VIEWER=review@ekklesiaevents.com \
 *     pnpm --filter @ekklesia/api demo-content --apply
 *
 * Put an organisation back into public discovery:
 *
 *   DEMO_ORGS=grace-community pnpm --filter @ekklesia/api demo-content --unmark --apply
 */

import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');
const unmark = process.argv.includes('--unmark');
const slugs = (process.env.DEMO_ORGS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const viewer = process.env.DEMO_VIEWER?.trim();

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
console.log(
  `Mode:     ${apply ? (unmark ? 'APPLY — unmark' : 'APPLY — mark') : 'report only (pass --apply to write)'}\n`,
);

const prisma = new PrismaClient();

try {
  // ─── What is set now ──────────────────────────────────────────────────────
  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      slug: true,
      name: true,
      isDemo: true,
      _count: { select: { events: true } },
    },
  });

  console.log('Organisations:');
  for (const o of orgs) {
    const mark = o.isDemo ? 'DEMO   ' : 'public ';
    console.log(`  ${mark} ${o.slug.padEnd(42)} ${o._count.events} event(s)   ${o.name}`);
  }

  const viewers = await prisma.user.findMany({
    where: { seesDemoContent: true },
    select: { email: true },
  });
  console.log(
    `\nAccounts that can see demo content: ${
      viewers.length ? viewers.map((u) => u.email).join(', ') : '(none)'
    }`,
  );

  if (!slugs.length && !viewer) {
    console.log('\nSet DEMO_ORGS and/or DEMO_VIEWER to change anything.');
    process.exit(0);
  }

  // ─── What would change ────────────────────────────────────────────────────
  console.log('\nPlanned changes:');
  const bySlug = new Map(orgs.map((o) => [o.slug, o]));
  const target = !unmark;
  const toChange = [];
  let missing = 0;

  for (const slug of slugs) {
    const org = bySlug.get(slug);
    if (!org) {
      // A typo here would otherwise do nothing at all and look like success,
      // which is the worst outcome for a script whose job is hiding things.
      console.log(`  ✗ ${slug.padEnd(42)} NO SUCH ORGANISATION — check the slug`);
      missing++;
      continue;
    }
    if (org.isDemo === target) {
      console.log(`  · ${slug.padEnd(42)} already ${target ? 'demo' : 'public'}, no change`);
      continue;
    }
    console.log(
      `  → ${slug.padEnd(42)} ${org.isDemo ? 'demo' : 'public'} -> ${target ? 'demo' : 'public'}   (${org._count.events} event(s))`,
    );
    toChange.push(slug);
  }

  let viewerRow = null;
  if (viewer) {
    viewerRow = await prisma.user.findUnique({
      where: { email: viewer },
      select: { id: true, email: true, seesDemoContent: true },
    });
    if (!viewerRow) {
      console.log(`  ✗ ${viewer.padEnd(42)} NO SUCH ACCOUNT — check the address`);
      missing++;
    } else if (viewerRow.seesDemoContent === target) {
      console.log(`  · ${viewer.padEnd(42)} already ${target ? 'can' : 'cannot'} see demo content`);
      viewerRow = null;
    } else {
      console.log(
        `  → ${viewer.padEnd(42)} ${target ? 'grant' : 'revoke'} demo content visibility`,
      );
    }
  }

  if (missing) {
    console.log(
      `\n${missing} name(s) did not match anything. Nothing has been written — fix them and re-run.`,
    );
    process.exit(1);
  }

  if (!toChange.length && !viewerRow) {
    console.log('\nNothing to do.');
    process.exit(0);
  }

  // What the public feed looks like afterwards, since that is the whole point.
  const futureAfter = await prisma.event.count({
    where: {
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      deletedAt: null,
      startsAt: { gte: new Date() },
      organization: {
        is: target
          ? { isDemo: false, slug: { notIn: toChange } }
          : { OR: [{ isDemo: false }, { slug: { in: toChange } }] },
      },
    },
  });
  console.log(
    `\nAfter this, public discovery shows ${futureAfter} upcoming event(s) to someone without an account.`,
  );

  if (!apply) {
    console.log('Nothing was changed. Re-run with --apply to write.');
    process.exit(0);
  }

  if (toChange.length) {
    const { count } = await prisma.organization.updateMany({
      where: { slug: { in: toChange } },
      data: { isDemo: target },
    });
    console.log(`\n✓ ${count} organisation(s) now ${target ? 'demo' : 'public'}`);
  }
  if (viewerRow) {
    await prisma.user.update({
      where: { id: viewerRow.id },
      data: { seesDemoContent: target },
    });
    console.log(`✓ ${viewerRow.email} ${target ? 'can' : 'can no longer'} see demo content`);
  }
} finally {
  await prisma.$disconnect();
}
