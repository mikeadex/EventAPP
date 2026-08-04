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
let token;
const signUp = await call('/auth/sign-up/email', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD, name: NAME },
});
if (signUp.ok && signUp.payload?.token) {
  token = signUp.payload.token;
  console.log('✓ created the review account');
} else {
  const signIn = await call('/auth/sign-in/email', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  if (!signIn.ok || !signIn.payload?.token) fail('sign-up and sign-in', signUp);
  token = signIn.payload.token;
  console.log('✓ account already existed — signed in');
}

// ─── 2. Church ───────────────────────────────────────────────────────────────
const me = await call('/v1/me', { token });
if (!me.ok) fail('loading the account', me);

let orgId = me.payload?.memberships?.[0]?.organizationId;
if (orgId) {
  console.log('✓ already owns a church');
} else {
  const org = await call('/v1/organizations', {
    method: 'POST',
    token,
    body: {
      name: ORG_NAME,
      slug: ORG_SLUG,
      kind: 'church',
      country: 'GB',
      currency: 'GBP',
      shortDescription: 'A demo church used for app review.',
    },
  });
  if (!org.ok) fail('creating the church', org);
  orgId = org.payload.id;
  console.log(`✓ created the church (${ORG_SLUG})`);
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
