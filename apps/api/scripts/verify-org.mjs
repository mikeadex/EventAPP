#!/usr/bin/env node
/**
 * Read the host review queue, and decide one.
 *
 * Until this existed, `PENDING` was a dead end. `isReadyForReview` moves an
 * organisation into the queue — on create, and now on every edit — but no code
 * path anywhere set `VERIFIED`; the only trace of the idea was a comment in
 * organizations.module.ts saying the transition "belongs to a reviewer". There
 * was no reviewer. GraceVille Community answered the verification questions on
 * 2026-08-24 and was still waiting seventy-four days later.
 *
 * This is that reviewer, in the same shape as the other operational scripts
 * here: it reports by default and writes only with --apply.
 *
 * Judging a host is a human decision, so this does not try to make it. It lays
 * out what each applicant submitted — contact, address, what they have
 * published — and then applies the decision you name. Every decision is
 * reversible by re-running with a different DECISION.
 *
 * Read the queue, changing nothing:
 *
 *   DATABASE_URL='<neon production url>' pnpm --filter @ekklesia/api verify-org
 *
 * Approve one:
 *
 *   DATABASE_URL='<neon production url>' \
 *     ORG=graceville-community DECISION=verify REVIEWER='mike' \
 *     pnpm --filter @ekklesia/api verify-org --apply
 *
 * DECISION is one of: verify, reject, suspend, unverify (unverify is the undo —
 * it returns an organisation to the queue's waiting room and clears verifiedAt).
 */

import { PrismaClient } from '@prisma/client';

const DECISIONS = {
  verify: { status: 'VERIFIED', sets: 'verifiedAt' },
  reject: { status: 'REJECTED', sets: null },
  suspend: { status: 'SUSPENDED', sets: null },
  unverify: { status: 'UNVERIFIED', sets: 'clear' },
};

/**
 * Addresses that cannot receive mail. Worth saying out loud on a review screen:
 * approving a host whose address blackholes means they will never hear that
 * they were approved. GraceVille's owner is `hey@gmail.con`, and the account
 * shows as email-verified regardless, so nothing else surfaces this.
 */
const UNDELIVERABLE = [
  'gmail.con', 'gmail.cmo', 'gmail.co', 'gmial.com', 'gmai.com',
  'yahoo.con', 'yahoo.cmo', 'hotmail.con', 'outlook.con', 'icloud.con',
];

const apply = process.argv.includes('--apply');
const slug = process.env.ORG?.trim();
const decision = process.env.DECISION?.trim().toLowerCase();
const reviewer = process.env.REVIEWER?.trim() || 'unattributed';

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
  `Mode:     ${apply ? `APPLY — ${decision ?? '(no DECISION)'}` : 'report only (pass --apply to write)'}\n`,
);

if (decision && !DECISIONS[decision]) {
  console.error(
    `DECISION='${decision}' is not one of: ${Object.keys(DECISIONS).join(', ')}. Nothing was written.`,
  );
  process.exit(1);
}

const prisma = new PrismaClient();
const iso = (d) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : '—');
const days = (d) => (d ? Math.floor((Date.now() - d.getTime()) / 86_400_000) : null);

try {
  // ─── The queue ────────────────────────────────────────────────────────────
  const orgs = await prisma.organization.findMany({
    orderBy: [{ verificationSubmittedAt: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      kind: true,
      country: true,
      isDemo: true,
      verificationStatus: true,
      verifiedAt: true,
      verificationSubmittedAt: true,
      contactName: true,
      contactEmail: true,
      contactPhone: true,
      addressLine1: true,
      city: true,
      postalCode: true,
      createdAt: true,
      memberships: {
        where: { role: 'OWNER' },
        select: { user: { select: { email: true, emailVerified: true } } },
      },
      _count: { select: { events: true } },
    },
  });

  const real = orgs.filter((o) => !o.isDemo);
  const waiting = real.filter((o) => o.verificationStatus === 'PENDING');
  const notAsked = real.filter((o) => o.verificationStatus === 'UNVERIFIED');
  const settled = real.filter(
    (o) => !['PENDING', 'UNVERIFIED'].includes(o.verificationStatus),
  );

  const show = (o, indent = '  ') => {
    const owner = o.memberships[0]?.user;
    const email = owner?.email ?? '(no owner)';
    const bad = UNDELIVERABLE.includes(email.split('@')[1]?.toLowerCase());
    const published = o._count.events;
    const wait = days(o.verificationSubmittedAt);
    console.log(`${indent}${o.name}   (${o.slug})`);
    console.log(`${indent}  owner        ${email}${bad ? '   ⚠ UNDELIVERABLE DOMAIN' : ''}`);
    console.log(`${indent}  status       ${o.verificationStatus}${
      wait !== null ? `   submitted ${iso(o.verificationSubmittedAt)}  (${wait}d ago)` : ''
    }${o.verifiedAt ? `   verified ${iso(o.verifiedAt)}` : ''}`);
    console.log(`${indent}  contact      ${o.contactName ?? '—'}   ${o.contactEmail ?? '—'}   ${o.contactPhone ?? '—'}`);
    console.log(`${indent}  address      ${[o.addressLine1, o.city, o.postalCode, o.country].filter(Boolean).join(', ') || '—'}`);
    console.log(`${indent}  events       ${published}`);
    console.log();
  };

  console.log(`Waiting for review — PENDING (${waiting.length}):\n`);
  if (!waiting.length) console.log('  (nobody)\n');
  waiting.forEach((o) => show(o));

  console.log(`Never submitted — UNVERIFIED (${notAsked.length}):`);
  for (const o of notAsked) {
    console.log(`  ${o.slug.padEnd(44)} ${o._count.events} event(s)   ${o.name}`);
  }
  console.log();

  if (settled.length) {
    console.log(`Already decided (${settled.length}):`);
    for (const o of settled) {
      console.log(
        `  ${o.verificationStatus.padEnd(11)} ${o.slug.padEnd(44)} ${o.name}`,
      );
    }
    console.log();
  }

  if (!slug) {
    console.log('Set ORG=<slug> and DECISION=verify|reject|suspend|unverify to decide one.');
    process.exit(0);
  }

  // ─── The decision ─────────────────────────────────────────────────────────
  const org = orgs.find((o) => o.slug === slug);
  if (!org) {
    // A typo would otherwise write nothing and read as success, which is the
    // worst outcome for a script that grants trust.
    console.error(`✗ ORG='${slug}' — NO SUCH ORGANISATION. Nothing was written.`);
    process.exit(1);
  }
  if (!decision) {
    console.error('✗ DECISION is not set. Nothing was written.');
    process.exit(1);
  }

  const { status, sets } = DECISIONS[decision];
  console.log('─'.repeat(72));
  console.log(`Decision: ${slug} — ${org.verificationStatus} -> ${status}\n`);
  show(org, '  ');

  if (org.verificationStatus === status) {
    console.log(`Already ${status}. Nothing to do.`);
    process.exit(0);
  }
  if (status === 'VERIFIED' && org.verificationStatus === 'UNVERIFIED') {
    // Not blocked — a reviewer may know a host personally — but it should never
    // happen by accident, because they never asked to be reviewed.
    console.log('⚠ This organisation never submitted details. Verifying it anyway.');
  }
  if (status === 'VERIFIED') {
    const missing = ['contactName', 'contactEmail', 'addressLine1', 'city'].filter(
      (f) => !org[f],
    );
    if (missing.length) console.log(`⚠ Submitted details are incomplete: missing ${missing.join(', ')}.`);
  }

  if (!apply) {
    console.log('\nNothing was changed. Re-run with --apply to write.');
    process.exit(0);
  }

  await prisma.$transaction(async (tx) => {
    await tx.organization.update({
      where: { id: org.id },
      data: {
        verificationStatus: status,
        ...(sets === 'verifiedAt' && { verifiedAt: new Date() }),
        ...(sets === 'clear' && { verifiedAt: null, verificationSubmittedAt: null }),
      },
    });
    await tx.auditLog.create({
      data: {
        // No actor: this is an operator at a terminal, not a signed-in user.
        // REVIEWER records who, by their own say-so, which is what a script can
        // honestly claim.
        organizationId: org.id,
        action: `organization.${decision}`,
        targetType: 'organization',
        targetId: org.id,
        metadata: {
          from: org.verificationStatus,
          to: status,
          reviewer,
          via: 'verify-org script',
        },
      },
    });
  });

  console.log(`\n✓ ${org.slug} is now ${status}   (recorded in the audit log as ${reviewer})`);
  if (status === 'VERIFIED') {
    const owner = org.memberships[0]?.user?.email;
    const bad = owner && UNDELIVERABLE.includes(owner.split('@')[1]?.toLowerCase());
    console.log(
      bad
        ? `  Tell them by some other route — ${owner} cannot receive mail.`
        : `  Nothing emails them automatically. Tell ${owner ?? 'the owner'} yourself.`,
    );
  }
} finally {
  await prisma.$disconnect();
}
