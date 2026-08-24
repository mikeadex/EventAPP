# Production infrastructure

What Ekklesia runs on today, what is missing before it can be called a finished
product, and what each gap actually costs. Written 2026-07-31 against commit
`d32fad0`.

Everything below is grounded in the current repo: the env vars are the ones the
code actually reads (`grep process.env`), and the "configured in production"
column is what `vercel env ls production` reports for `ekklesia_backend`.

**Re-audited 2026-08-15.** Production still has the same five variables it had
on day one. Everything in section 2 remains outstanding. Since the first pass,
CI was fixed and is green, the host workflow shipped on web and mobile, and
events can now be hybrid — but no third-party service has been switched on yet.

---

## 1. What is already running

| Layer | Service | Where | State |
|---|---|---|---|
| API | Vercel serverless (NestJS 10, CommonJS) | `ekklesiabackend-bay.vercel.app` | Live, auto-deploys from `main` |
| Database | Neon Postgres (+ Prisma 5.22) | `eu-*` Neon project | Live, migrations via `prisma migrate deploy` |
| Web | Vercel (Next.js) | `ekklesia-web-indol.vercel.app` | Live, Git-connected, root `apps/web` |
| Auth | Better Auth 1.6.11, bearer plugin | in-API | Live, 30-day sessions |
| Mobile builds | EAS Build | iOS cloud / Android local | TestFlight + Play internal testing |
| Mobile updates | EAS Update (expo-updates) | channel `production` | Live — ship JS without a store review |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | on push + PR | Typecheck, lint, test, Prisma validate/migrate against a Postgres service |

> **Correction (same day).** When first written, this row described CI as if it
> worked. It did not: every run since the workflow was added had failed in ~30
> seconds at `actions/setup-node`, because pnpm 11 requires Node ≥ 22.13 and the
> workflow pinned 22.12.0 — nothing was installed and no check ever ran. Fixed in
> `027e2e9`, along with the two steps that turned out to be hollow once it could
> run: `Test` passed vacuously (no jest config, no specs) and `Lint` had no
> ESLint config in `apps/api`. Both are now real, and CI is green.
| Source | GitHub `mikeadex/EventAPP` | public repo | Keep secrets out |

**The good news:** hosting, database, auth, CI, and both mobile delivery
pipelines are done. The gaps below are almost entirely *third-party accounts you
have not opened yet* — not code that needs writing. The integrations are already
built and waiting on credentials.

---

## 2. Configured vs. required — the actual gap

Production currently has **five** environment variables set:

```
DATABASE_URL  BETTER_AUTH_SECRET  BETTER_AUTH_URL  WEB_URL  TRUSTED_ORIGINS
```

The code reads thirteen more. Each missing group disables a real feature:

| Env vars | Feature | Behaviour today (verified in code) |
|---|---|---|
| `RESEND_API_KEY`, `EMAIL_FROM` | All transactional email | **Silently logs instead of sending.** Password reset is a dead end — the user gets no email and no error. Highest-impact gap. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`, `S3_PUBLIC_BASE` | Organiser image uploads | `POST /v1/uploads/sign` returns **503**. Event covers can only be external URLs. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Paid tickets | Payment flows fail. Free RSVPs are unaffected. |
| `GOOGLE_*`, `APPLE_*`, `MICROSOFT_*` | Social sign-in | No buttons appear. Email/password is unaffected. See section 9. |

`API_PORT` and `NODE_ENV` need no action (serverless supplies them);
`MOBILE_DEEPLINK_SCHEME` already defaults to `ekklesia`.

> Vercel env changes require a **redeploy** to take effect — setting a variable
> alone does nothing to the running deployment.

---

### The host workflow specifically

Verified end to end against a local stack on 2026-07-31: sign up → create
organisation → create event → publish → appears in the public feed → another
user RSVPs. All of it works, and a presigned cover-image upload succeeds
locally against MinIO. It is **web only** (`/organizer/…`); the mobile app is
attendee-facing.

**Updated 2026-08-15.** The gaps listed here have since been built, on web and
in the mobile app: event editing, ticket types (so paid tickets can be defined),
an attendee list with door check-in, three-step host onboarding that puts new
hosts into a `PENDING` review queue, and hybrid in-person/online events.

What is still missing for a host to run events unaided:

- **No S3 in production**, so cover-image upload is the one step that fails
  outside local dev (`503`). Priority 2 below.
- **No way to edit host details after setup** — there is no update endpoint on
  organizations at all, so a typo in the host name or About text is permanent.
- **No admin review UI.** Hosts reach `PENDING`, but approving one currently
  means a database update. Deferred to the web app by choice.
- **No QR scanner** — check-in is type-the-code or tap-the-row.
- **Events are same-day only** — one date with two times, so an overnight or
  weekend event cannot be expressed.

## 3. Services to add, in priority order

### Priority 1 — needed before inviting real users

**Email delivery — Resend** (already a dependency; the wrapper is written)
- Free tier: 3,000 emails/month, 100/day. Paid from $20/mo.
- Requires a **domain you own** with DNS records (SPF, DKIM, and ideally DMARC).
  You cannot send from a gmail.com address. This is the long pole — buy the
  domain first if you have not.
- Without it, nobody can recover a forgotten password. That alone blocks a real
  beta.

**Error tracking — Sentry** (nothing like this exists in the repo today)
- Free tier: 5,000 errors/month — comfortably enough at your stage.
- Right now a production 500 is effectively invisible. `vercel logs` on the CLI
  streams only *live* traffic — it showed nothing at all when I tried it against
  an idle API — and dashboard retention on lower plans is measured in hours. You
  found today's bugs because a human reported them; that does not scale past a
  handful of testers.
- Covers API (Node SDK), web (Next.js SDK), and mobile (`@sentry/react-native`,
  which also symbolicates native iOS/Android crashes).

**Uptime monitoring — Better Stack, UptimeRobot, or Checkly**
- Free tiers are adequate: hit `/health` every 5 minutes, alert by email/SMS.
- `/health` already returns `{status, db}` and exercises the database, so it is a
  genuine end-to-end check, not just a ping.

### Priority 2 — needed for full feature parity

**Object storage — Cloudflare R2** (recommended over AWS S3)
- The code uses the S3 API via `@aws-sdk/client-s3` with a configurable
  `S3_ENDPOINT`, so R2 is a drop-in: no code changes, just the six env vars.
- **Zero egress fees**, which matters because event cover images are read far
  more than written. $0.015/GB-month storage; realistically pennies at your size.
- Set `S3_PUBLIC_BASE` to a public bucket domain or CDN hostname so images are
  served directly rather than through the API.
- Configure **CORS on the bucket** for browser/mobile direct uploads, since the
  flow is presigned-PUT.

**Push notifications — Expo Push** (free)
- Requires APNs key (Apple) and FCM credentials (Google), both included with the
  developer accounts you already pay for.
- Needs a **new native build**, not an OTA update — bump the version so
  `runtimeVersion` isolates old clients.

### Priority 3 — needed before taking money

**Stripe** — live keys plus a webhook endpoint pointed at the API. Test mode
first. Taking payments raises the compliance bar considerably (PCI SAQ-A via
Stripe-hosted checkout, refund policy, tax handling); do not switch this on
casually.

---

## 4. Database — what to do about Neon

The current setup works, but two things deserve attention before real data
exists:

**Backups.** Neon's free tier retains a limited point-in-time recovery window.
Confirm the retention on your plan and, if it is short, either upgrade or add a
scheduled `pg_dump` to object storage. **This is the one gap where the failure is
unrecoverable** — everything else on this page costs you an outage; losing the
database costs you the product.

**Connection handling.** Keep using the **pooled** URL for the API and the
**direct** URL for `prisma migrate deploy` — migrations fail through the pooler.
The stale-connection retry added in `d32fad0` (`apps/api/src/prisma/db-retry.ts`)
covers Neon's auto-suspend closing sockets under a warm serverless instance; see
the `serverless-db-resilience` note for how to reproduce that failure.

If you later outgrow serverless-per-request connections, the next step is Neon's
serverless driver over HTTP rather than a bigger pool.

---

## 5. Logging and observability

Today: `console`/Nest logger → Vercel's log stream, with `app.flushLogs()` after
init so errors are not swallowed. That is fine for debugging a deploy and useless
for everything else — there is no history, no search, no alerting.

A realistic target, cheapest first:

1. **Sentry** for errors and stack traces (Priority 1 above). Biggest single win.
2. **Log drain** to a searchable store — Better Stack, Axiom, or Datadog. Vercel
   supports drains natively; Axiom and Better Stack both have usable free tiers.
3. **Vercel Analytics / Speed Insights** for web vitals, if the marketing site
   starts to matter.
4. **Structured logging** — worth doing when you add the drain, so logs are
   queryable by request id, user id, and org id rather than grepped as prose.

One warning drawn from experience on this project: a secret was once pasted into
`BETTER_AUTH_URL` and surfaced in an error log. `src/env.ts` now validates URL
shape and reports **length only, never contents**. Keep that property when adding
any new logging — a log drain multiplies the blast radius of a leaked secret,
because it persists and is searchable.

---

## 6. Compliance — do not skip this one

Ekklesia records **who is attending religious events**. Under UK GDPR that is
special-category data (Article 9: religious belief), which carries obligations
beyond ordinary personal data. The app is already built around this — attendee
visibility is opt-in by default and withdrawable per ticket — but the paperwork
is not optional:

- **ICO registration.** UK data controllers generally must pay the ICO data
  protection fee (~£52/year for small organisations). This is a legal
  requirement, not best practice.
- **Lawful basis under Article 9** — explicit consent is the workable one here,
  which is exactly why `showAsAttending` defaults to false.
- **DPIA.** Special-category data plus a public-facing list makes a Data
  Protection Impact Assessment strongly advisable, arguably mandatory.
- **Processor DPAs** with every service on this page that touches user data —
  Vercel, Neon, Resend, Sentry, Cloudflare. All publish standard DPAs; you need
  to actually accept them, and check where each stores data (prefer EU/UK
  regions).
- **Legal review of `privacy` and `terms`.** Both pages are drafted and shipped
  but have **not** been reviewed by a solicitor. Do this before a public launch.
- **Data retention policy** — decide how long tickets, accounts, and moderation
  records live. Account deletion is already implemented.
- **Sentry scrubbing** — configure it *not* to capture request bodies or user
  emails by default, or your error tracker becomes an unlawful secondary store of
  special-category data.

---

## 7. Rough monthly cost

| Service | Free tier realistic? | Paid from |
|---|---|---|
| Vercel (2 projects) | Yes, at beta scale | $20/mo Pro |
| Neon Postgres | Yes | ~$19/mo for longer PITR |
| Cloudflare R2 | ~Yes (10 GB free) | ~$0.015/GB-month |
| Resend | Yes (3k/mo) | $20/mo |
| Sentry | Yes (5k errors) | $26/mo |
| Uptime monitoring | Yes | ~$0–7/mo |
| Expo EAS | Free tier covers local Android + occasional iOS | $19/mo faster builds |
| Apple Developer | — | $99/year (paid) |
| Google Play | — | $25 one-off (paid) |
| Domain + ICO fee | — | ~£10–15/yr + ~£52/yr |

**Beta can run at roughly £0–20/month** beyond the store fees you have already
paid, plus the domain and ICO registration. Costs only become real at scale or
when you start taking payments.

---

## 8. Suggested order of work

0. Social sign-in credentials (section 9) — the server is ready and waiting;
   web works the moment they exist.
1. ~~Buy the domain~~ — done: `ekklesiaevents.com`. Now migrate onto it; this
   unblocks email (and so password reset) **and fixes web sign-in in Safari**.
   See "Domain migration" below for the ordered steps.
2. Resend + DNS records → set `RESEND_API_KEY`, `EMAIL_FROM` → **redeploy**.
3. Sentry on API + mobile — stop finding bugs by user report.
4. Uptime check on `/health`.
5. Confirm Neon backup retention; add `pg_dump` if the window is thin.
6. Cloudflare R2 → the six `S3_*` vars → redeploy → organiser uploads work.
7. ICO registration + DPIA + solicitor review of the legal pages.
8. Push notifications (needs a native build, so batch with other native work).
9. Stripe, only when paid tickets are actually wanted.

Items 1–4 are what separate "works when I am watching" from "runs without me".

---

### Domain migration — ekklesiaevents.com

The domain is not only an email dependency. It is what fixes web sign-in in
Safari, and it should be done before inviting real users.

**Why.** Cookies are scoped by *registrable domain*, not by origin. Today the
web app and the API share only `vercel.app`, which is on the Public Suffix
List — so the browser counts them as different **sites** and the session cookie
is third-party. It is currently sent `SameSite=None; Secure` to work around
that, which Chrome, Edge and Firefox honour but Safari blocks outright (on iOS
that means every browser, since they all use WebKit). Once the two hostnames
share `ekklesiaevents.com` the cookie is first-party and the problem is gone.

**Hostname → project.** A domain is not assigned to one project; each hostname
is added to a project and Vercel routes by hostname.

| Hostname | Vercel project | Role |
| --- | --- | --- |
| `www.ekklesiaevents.com` | ekklesia-web | the site (canonical) |
| `ekklesiaevents.com` | ekklesia-web | 308 redirect to `www` |
| `api.ekklesiaevents.com` | ekklesiabackend | the API |

As configured, the apex redirects to `www`, so **`www` is the canonical
origin** and every URL below uses it. Flipping the primary to the bare domain
in Vercel is fine too — just swap the values consistently, because a
`WEB_URL` that only ever redirects will produce links with a needless hop and
an origin that never matches.

Both projects keep their `*.vercel.app` hostnames working alongside the custom
ones, so mobile installs already in the wild keep running throughout.

**Steps, in order.**

1. Add each hostname to its project in Vercel (Project → Settings → Domains).
   Vercel prints the exact DNS record to create for each one — use those values
   rather than any written here, as the apex record in particular changes.
   Create them at the registrar, then wait for verification and the TLS
   certificate.

2. Set the environment variables. **API project:**

   | Variable | Value |
   | --- | --- |
   | `BETTER_AUTH_URL` | `https://api.ekklesiaevents.com` |
   | `TRUSTED_ORIGINS` | `https://www.ekklesiaevents.com,https://ekklesiaevents.com,https://ekklesia-web-indol.vercel.app` |
   | `WEB_URL` | `https://www.ekklesiaevents.com` |

   The old `*.vercel.app` web origin stays in `TRUSTED_ORIGINS` only until the
   new domain is confirmed working; drop it in the cleanup step, since leaving
   it is what would keep needing `SameSite=None`.

   **Web project:**

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://api.ekklesiaevents.com` |
   | `NEXT_PUBLIC_WEB_URL` | `https://www.ekklesiaevents.com` |

   `TRUSTED_ORIGINS` drives both CORS (`bootstrap.ts`) and Better Auth's origin
   check, so it must list every origin the browser actually uses. Redeploy both
   projects afterwards — `NEXT_PUBLIC_*` is inlined at build time, so the web
   app will not pick up a new value without one.

3. In the Google Cloud console, add `https://api.ekklesiaevents.com/auth/callback/google`
   to the OAuth client's authorised redirect URIs. Leave the existing
   `*.vercel.app` URI in place until the migration is confirmed.

4. Verify: sign in on `https://www.ekklesiaevents.com` in **Safari**. That is
   the case that fails today, so it is the one worth checking.

5. Only then, in the repo: point mobile at the new API (`apps/mobile/eas.json`,
   both profiles, and the `ota:prod` script in `apps/mobile/package.json`), and
   publish with `pnpm run ota:prod`. Never a bare `eas update` — the script
   pins the public URLs, and a bare update once baked a LAN IP into production.

6. Housekeeping once settled: drop the `*.vercel.app` web origin from
   `TRUSTED_ORIGINS`, then set `advanced.defaultCookieAttributes` in
   `apps/api/src/modules/auth/auth.ts` back to `SameSite=Lax`. Neither is
   required — `None` works fine first-party — but `Lax` is the better default
   once nothing needs the cookie sent cross-site, and the two go together:
   flipping to `Lax` is what finally stops the old vercel.app URL working.

Deep links still use the `ekklesia://` scheme. Universal links on
`ekklesiaevents.com` are a separate piece of native work; batch them with push
notifications rather than doing them here.

## 9. Social sign-in — Google, Apple, Microsoft

The server side is built and deployed. Each provider switches itself on only
when its credentials are present, so nothing changes until you create them, and
a half-configured provider is left out rather than offering a button that
dead-ends. `GET /v1/config` reports which are live; the web sign-in and sign-up
pages render buttons from that list and show nothing when it is empty.

**What only you can create** (they are accounts and signing keys):

*Google* — Google Cloud Console → APIs & Services → Credentials → OAuth client
ID (Web application). Authorised redirect URI:
`https://ekklesiabackend-bay.vercel.app/auth/callback/google`.
Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

*Microsoft (Outlook)* — Entra ID → App registrations → New registration, with
"Accounts in any organizational directory and personal Microsoft accounts" so
Outlook.com addresses work. Redirect URI (type Web):
`https://ekklesiabackend-bay.vercel.app/auth/callback/microsoft`.
Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`; `MICROSOFT_TENANT_ID`
defaults to `common`.

*Apple* — Developer portal → Identifiers → Services ID (this is the OAuth client
id, not the app bundle id), plus a Sign in with Apple key (.p8). Return URL:
`https://ekklesiabackend-bay.vercel.app/auth/callback/apple`.
Set `APPLE_CLIENT_ID` (the Services ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`,
`APPLE_PRIVATE_KEY` (the .p8 contents — `\n` escapes are un-escaped for you),
and `APPLE_BUNDLE_ID` (`com.ekklesia`) for the native flow.

Remember Vercel env changes need a **redeploy** to take effect.

**Two things to plan around.**

*Apple's rule.* If the iOS app offers Google or Microsoft sign-in, it **must**
also offer Sign in with Apple. So Apple is not optional once the others ship on
mobile — it is a review requirement.

*Mobile needs a native build.* The web flow is a browser redirect and works
today. Native cannot redirect without `expo-web-browser` (and ideally
`expo-apple-authentication` for the proper Apple sheet), which are native
modules. Adding them means a new binary and a store submission — it cannot ride
the over-the-air channel everything else has used. Plan it alongside the other
native work already queued (push notifications, the QR scanner), so one build
cycle covers all three.

*Privacy policy.* Naming Google, Apple and Microsoft as third-party
authentication providers is part of switching this on, not an afterthought.
