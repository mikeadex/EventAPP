#!/usr/bin/env node
/**
 * Creates the demo account App Store / Play reviewers sign in with, using the
 * app's own public endpoints — no database access and no secrets in this repo.
 *
 * The account is given a church with a published event and a registered
 * attendee, so a reviewer can exercise the whole product from one login:
 * browse, RSVP, and the organiser side (edit, ticket types, door check-in).
 *
 * Usage — pick a password yourself and keep it somewhere safe, since you will
 * paste it into App Store Connect:
 *
 *   API_URL=https://ekklesiabackend-bay.vercel.app \
 *   REVIEW_EMAIL=review@yourdomain.com \
 *   REVIEW_PASSWORD='...' \
 *   node apps/api/scripts/create-review-account.mjs
 *
 * Safe to re-run: if the account already exists it signs in instead, and it
 * skips creating the church or event when they are already there.
 */

const API = process.env.API_URL ?? 'http://localhost:4000';
const EMAIL = process.env.REVIEW_EMAIL;
const NAME = process.env.REVIEW_NAME ?? 'App Review';
const ORG_NAME = process.env.REVIEW_ORG_NAME ?? 'St Cuthbert’s Demo Church';
const ORG_SLUG = process.env.REVIEW_ORG_SLUG ?? 'demo-church';

if (!EMAIL) {
  console.error('Set REVIEW_EMAIL (and optionally API_URL).');
  process.exit(1);
}

/**
 * Prompt rather than read the environment when no password is supplied, so it
 * never has to be typed on a command line and left in shell history. Echo is
 * disabled while typing where the terminal allows it.
 */
async function promptForPassword() {
  const { createInterface } = await import('node:readline');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  process.stdout.write('Password for the review account: ');
  if (process.stdin.isTTY) process.stdin.setRawMode?.(false);
  const muted = process.stdin.isTTY;
  if (muted) {
    // Suppress echo by intercepting what readline writes back out.
    rl.output.write = ((write) => (chunk, ...rest) =>
      /\n/.test(String(chunk)) ? write.call(rl.output, chunk, ...rest) : true)(
      rl.output.write,
    );
  }
  const answer = await new Promise((resolve) => rl.question('', resolve));
  rl.close();
  process.stdout.write('\n');
  return answer;
}

const PASSWORD = process.env.REVIEW_PASSWORD ?? (await promptForPassword());
if (!PASSWORD) {
  console.error('A password is required.');
  process.exit(1);
}

// Node's fetch attaches `Origin: null` to POSTs, which Better Auth rejects with
// MISSING_OR_NULL_ORIGIN. The mobile deep-link scheme is always in the server's
// trusted origins, so borrowing it makes this behave like the app itself.
const ORIGIN = process.env.MOBILE_DEEPLINK_SCHEME
  ? `${process.env.MOBILE_DEEPLINK_SCHEME}://`
  : 'ekklesia://';

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      origin: ORIGIN,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }
  return { ok: res.ok, status: res.status, payload };
}

function fail(step, res) {
  const message =
    (res.payload && typeof res.payload === 'object' && res.payload.message) ||
    JSON.stringify(res.payload)?.slice(0, 300);
  console.error(`\n✗ ${step} failed (${res.status}): ${message}`);
  process.exit(1);
}

const iso = (msFromNow) => new Date(Date.now() + msFromNow).toISOString();

console.log(`API: ${API}`);

// ─── 1. Account ──────────────────────────────────────────────────────────────
/**
 * Mark the account's email verified directly.
 *
 * Sign-up no longer returns a session: `requireEmailVerification` is on, so the
 * account cannot sign in until its address is confirmed by clicking a link in
 * an email. A review account has no mailbox anyone is watching, so without this
 * the reviewer is handed credentials that cannot log in — which is a rejection,
 * not a bug they will report back to us.
 *
 * Needs DATABASE_URL because there is deliberately no API route that marks
 * somebody else verified.
 */
async function verifyDirectly() {
  if (!process.env.DATABASE_URL) {
    console.error(`
✗ The account was created but cannot sign in yet: its email is unverified,
  and sign-in requires verification.

  Re-run with DATABASE_URL set so this script can confirm the address:

    DATABASE_URL='<neon production url>' API_URL=${API} \\
      REVIEW_EMAIL=${EMAIL} pnpm --filter @ekklesia/api review-account

  Or click the verification link sent to ${EMAIL}, if that mailbox is real.
`);
    process.exit(1);
  }
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.user.update({ where: { email: EMAIL }, data: { emailVerified: true } });
    console.log('✓ marked the review address verified');
  } finally {
    await prisma.$disconnect();
  }
}

/** Returns the session token, or the error code explaining why not. */
async function signIn() {
  const res = await call('/auth/sign-in/email', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  if (res.ok && res.payload?.token) return { token: res.payload.token };
  return { code: res.payload?.code ?? `HTTP_${res.status}`, res };
}

/**
 * Sign in first, and only sign up if that fails.
 *
 * Sign-up cannot tell us whether it created anything: Better Auth answers a
 * duplicate sign-up with a fabricated 200 — a fresh-looking id and
 * `emailVerified: false` — so that an attacker cannot use it to discover which
 * addresses are registered. Reading that as "created" made this script claim it
 * had made an account when it had not, which is the one thing a script run
 * against production must not do.
 *
 * Signing in first is unambiguous: it either works or names its reason.
 */
function refuseWrongPassword() {
  console.error(`
✗ ${EMAIL} is already registered, and not with this password. Nothing was
  changed. Re-run with that account's real password, or pick a different
  REVIEW_EMAIL.
`);
  process.exit(1);
}

let token;
{
  let attempt = await signIn();

  if (attempt.token) {
    console.log('✓ account already existed — signed in');
  } else {
    if (attempt.code !== 'EMAIL_NOT_VERIFIED') {
      // No account we can use, so make one. A duplicate is answered with that
      // same fabricated 200, so the sign-in afterwards is what tells us whether
      // we actually own this address.
      const signUp = await call('/auth/sign-up/email', {
        method: 'POST',
        body: { email: EMAIL, password: PASSWORD, name: NAME },
      });
      if (!signUp.ok) fail('creating the review account', signUp);
      attempt = await signIn();
      if (attempt.code === 'INVALID_EMAIL_OR_PASSWORD') refuseWrongPassword();
      console.log('✓ created the review account');
    } else {
      console.log('✓ account already existed — but its email was never verified');
    }

    // Only ever verify an address we have just proved we hold the password for.
    // EMAIL_NOT_VERIFIED is that proof: it is returned for correct credentials
    // and an unconfirmed address. Verifying on any weaker signal would mean a
    // mistyped REVIEW_EMAIL could confirm a stranger's address for them.
    if (attempt.code === 'EMAIL_NOT_VERIFIED') {
      await verifyDirectly();
      attempt = await signIn();
    }
    if (!attempt.token) {
      if (attempt.code === 'INVALID_EMAIL_OR_PASSWORD') refuseWrongPassword();
      fail('signing in after verification', attempt.res);
    }
  }
  token = attempt.token;
}

// ─── 2. Church ───────────────────────────────────────────────────────────────
const me = await call('/v1/me', { token });
if (!me.ok) fail('loading the account', me);

let orgId = me.payload?.memberships?.[0]?.organizationId;
if (orgId) {
  console.log('✓ already owns a church');
} else {
  /**
   * Slugs are unique across the platform, so a demo church left behind by an
   * earlier review account blocks this one — and that account's password is
   * long gone, so adopting its church is not an option. Take the next free
   * slug instead of stopping: the point is a reviewable account, and the slug
   * is not what is being reviewed.
   */
  const createChurch = (slug) =>
    call('/v1/organizations', {
      method: 'POST',
      token,
      body: {
        name: ORG_NAME,
        slug,
        kind: 'church',
        country: 'GB',
        currency: 'GBP',
        shortDescription: 'A demo church used for app review.',
      },
    });

  let slug = ORG_SLUG;
  let org = await createChurch(slug);
  for (let n = 2; !org.ok && org.status === 409 && n <= 20; n += 1) {
    slug = `${ORG_SLUG}-${n}`;
    org = await createChurch(slug);
  }
  if (!org.ok) fail('creating the church', org);
  orgId = org.payload.id;
  console.log(
    slug === ORG_SLUG
      ? `✓ created the church (${slug})`
      : `✓ created the church (${slug} — "${ORG_SLUG}" was already taken)`,
  );
}

// ─── 3. A published event to look at ─────────────────────────────────────────
const existing = await call(`/v1/organizations/${orgId}/events`, { token });
if (!existing.ok) fail('listing events', existing);

let eventId = existing.payload?.[0]?.id;
if (eventId) {
  console.log('✓ church already has an event');
} else {
  const event = await call(`/v1/organizations/${orgId}/events`, {
    method: 'POST',
    token,
    body: {
      title: 'Sunday Gathering',
      summary: 'Weekly worship, teaching and coffee afterwards.',
      description:
        'A demo event for app review. Everyone is welcome — come as you are.',
      category: 'service',
      startsAt: iso(3 * 24 * 60 * 60 * 1000),
      endsAt: iso(3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      timezone: 'Europe/London',
      isOnline: false,
      venue: {
        name: 'Demo Hall',
        addressLine1: '1 Example Street',
        city: 'London',
        postalCode: 'EC1A 1AA',
        country: 'GB',
      },
    },
  });
  if (!event.ok) fail('creating the event', event);
  eventId = event.payload.id;

  const published = await call(`/v1/events/${eventId}/publish`, {
    method: 'POST',
    token,
    body: {},
  });
  if (!published.ok) fail('publishing the event', published);
  console.log('✓ created and published "Sunday Gathering"');
}

console.log(`
Done. Paste these into App Store Connect → Test Information → Sign-In:

  User Name: ${EMAIL}
  Password:  (the REVIEW_PASSWORD you chose)

The reviewer can browse events, RSVP, and open Profile → "Manage your events"
to edit the event, add ticket types and check attendees in.
`);
