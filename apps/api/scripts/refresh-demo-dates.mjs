#!/usr/bin/env node
/**
 * Move the demo events forward so the app's feed is not empty.
 *
 * The mobile feed asks for `startsAfter=now`, so an event whose date has passed
 * disappears from it. The seeded demo events were dated for late July and
 * August, which is why the app currently shows two events rather than eleven —
 * fine for a database, useless for a screenshot or a reviewer's first look.
 *
 * This re-dates what is already there rather than creating more. Those events
 * already have working cover images; new ones would need new images and would
 * leave more demo data behind to clean up later.
 *
 * Usage — reports without changing anything:
 *
 *   DATABASE_URL='<neon production url>' pnpm --filter @ekklesia/api refresh-demo-dates
 *
 * Add --apply once the report looks right.
 *
 * Safe with respect to notifications: attendees are pushed on *publish* and on
 * *cancel*, neither of which this does, and the reminder cron only fires for
 * events starting within two hours — everything here lands days away.
 */

import { PrismaClient } from '@prisma/client';

const apply = process.argv.includes('--apply');

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
console.log(apply ? 'Mode:     APPLY\n' : 'Mode:     report only (pass --apply to write)\n');

/**
 * When each kind of thing plausibly happens, so the feed reads like a real
 * week rather than a row of identical slots. Times are UTC; London is BST
 * (UTC+1) through late October, so 18:00 here is a 7pm start.
 */
const SLOTS = [
  { match: /sunday|service|worship night/i, dayOfWeek: 0, hour: 10, minute: 0 },
  { match: /prayer/i, dayOfWeek: 3, hour: 7, minute: 0 },
  { match: /youth|kids/i, dayOfWeek: 5, hour: 17, minute: 30 },
  { match: /bbq|social|gathering|family/i, dayOfWeek: 6, hour: 12, minute: 0 },
  { match: /conference|course|class/i, dayOfWeek: 4, hour: 18, minute: 0 },
  { match: /gala|dinner|fundraiser/i, dayOfWeek: 6, hour: 18, minute: 30 },
  { match: /outreach/i, dayOfWeek: 6, hour: 10, minute: 0 },
];

/** The next occurrence of `dayOfWeek` at least `minDaysAhead` from now. */
function nextDate(dayOfWeek, hour, minute, minDaysAhead) {
  const d = new Date();
  d.setUTCHours(hour, minute, 0, 0);
  d.setUTCDate(d.getUTCDate() + minDaysAhead);
  while (d.getUTCDay() !== dayOfWeek) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

const prisma = new PrismaClient();

try {
  const events = await prisma.event.findMany({
    where: { status: 'PUBLISHED', deletedAt: null },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      coverImageUrl: true,
      organization: { select: { name: true } },
      _count: { select: { tickets: true } },
    },
  });

  if (!events.length) {
    console.log('No published events found.');
    process.exit(0);
  }

  // Only pull *past* events forward. An event already in the future is
  // presumably dated deliberately, and dragging it backwards would move a real
  // booking to a date nobody chose.
  const now = new Date();
  const stale = events.filter((e) => e.startsAt < now);
  const upcoming = events.filter((e) => e.startsAt >= now);

  for (const e of upcoming) {
    console.log(`  keep  ${e.title.slice(0, 26).padEnd(28)} ${e.startsAt.toISOString().slice(0, 16).replace('T', ' ')}  (already upcoming)`);
  }
  if (!stale.length) {
    console.log('\nEvery published event is already in the future. Nothing to do.');
    process.exit(0);
  }
  if (upcoming.length) console.log('');

  // Spread across the coming weeks: two events per week, earliest a few days
  // out so nothing lands inside the reminder window.
  let lead = 3;
  const plan = [];
  for (const [i, e] of stale.entries()) {
    const slot = SLOTS.find((s) => s.match.test(e.title)) ?? {
      dayOfWeek: 4,
      hour: 18,
      minute: 30,
    };
    const startsAt = nextDate(slot.dayOfWeek, slot.hour, slot.minute, lead);
    // Keep each event's own duration rather than imposing one.
    const durationMs = Math.max(
      (e.endsAt?.getTime() ?? 0) - e.startsAt.getTime(),
      90 * 60 * 1000,
    );
    plan.push({ e, startsAt, endsAt: new Date(startsAt.getTime() + durationMs) });
    if (i % 2 === 1) lead += 7;
  }

  const iso = (d) => d.toISOString().replace('T', ' ').slice(0, 16);
  let ticketed = 0;
  for (const { e, startsAt } of plan) {
    const img = e.coverImageUrl ? '' : '   [no cover image]';
    const tix = e._count.tickets ? `   ${e._count.tickets} ticket(s)` : '';
    if (e._count.tickets) ticketed += e._count.tickets;
    console.log(
      `  ${e.title.slice(0, 26).padEnd(28)} ${iso(e.startsAt)}  ->  ${iso(startsAt)}${tix}${img}`,
    );
  }

  if (ticketed) {
    console.log(
      `\nNote: ${ticketed} ticket(s) exist on these events. Moving a date does not
notify anyone — attendees are pushed on publish and on cancel, not on edit —
but those people will see the new date when they next open their ticket.`,
    );
  }

  if (!apply) {
    console.log('\nNothing was changed. Re-run with --apply to write.');
    process.exit(0);
  }

  for (const { e, startsAt, endsAt } of plan) {
    await prisma.event.update({ where: { id: e.id }, data: { startsAt, endsAt } });
  }
  console.log(`\n✓ moved ${plan.length} event(s)`);
} finally {
  await prisma.$disconnect();
}
