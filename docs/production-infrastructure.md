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
| API | Vercel serverless (NestJS 10, CommonJS) | `api.ekklesiaevents.com` | Live, auto-deploys from `main` |
| Database | Neon Postgres (+ Prisma 5.22) | Neon `us-east-1` (**not** EU — see §4) | Live, migrations via `prisma migrate deploy` |
| Web | Vercel (Next.js) | `ekklesiaevents.com` | Live, Git-connected, root `apps/web` |
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
| ~~`S3_*`~~ | Organiser image uploads | **Done** — Backblaze B2, live 2026-09-02. |
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

**Object storage — Backblaze B2** (in use since 2026-09-02)
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

**The database is in `us-east-1`, not the EU.** This doc previously said `eu-*`,
which was wrong. It matters more here than on a typical project: the Privacy
Policy identifies RSVPs to faith events as **special category data** under
Article 9, and the controller is UK-based.

This is legally workable, and the policy already describes it — §7 says data is
processed outside the UK and EEA "including in the United States", relying on the
UK IDTA or SCCs plus a **transfer risk assessment**. Two things follow:

1. **That transfer risk assessment needs to actually exist.** The policy asserts
   one does. It is the first thing a legal reviewer will ask for, and the ICO
   expects it in writing for Article 9 data going to the US.
2. **Moving region later is not a settings change.** Neon cannot relocate a
   project between regions — it means a new project and a data migration. Doing
   that now, with almost no real user data, is a morning's work. After launch it
   is a maintenance window and a risk.

Worth a decision before launch rather than after: keep `us-east-1` and hold a
written TRA, or move to a Neon EU region and simplify the transfer story to
nothing.

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

0. ~~Social sign-in~~ — done. Google and Apple are live on web, iOS and
   Android. Microsoft is still unconfigured and entirely optional.
1. ~~Buy the domain, migrate onto it~~ — done: `ekklesiaevents.com`. Web
   sign-in is confirmed working on it. Kept below as a record of what was
   changed and why.
2. ~~Resend~~ — done. Sending from `Ekklesia <david@ekklesiaevents.com>`,
   password reset confirmed arriving.

   **Still outstanding: register that sender with Apple's Private Email
   Relay** (developer.apple.com → Services → Sign in with Apple for Email
   Communication). Until then, mail to "Hide My Email" users is dropped by
   Apple with no bounce — see section 9.

   Worth remembering how this component fails: `EmailService.send` logs and
   returns `{ id: null }` rather than throwing, because the caller has already
   committed the user-facing action. That is the right behaviour, but it means
   a broken mailer is invisible from the outside — the API returns 200 either
   way, and Better Auth returns 200 for unknown addresses too so accounts
   cannot be enumerated. Resend's dashboard is the real log.
3. Sentry on API + mobile — stop finding bugs by user report.
4. Uptime check on `/health`.
5. Confirm Neon backup retention; add `pg_dump` if the window is thin.
6. Cloudflare R2 → the six `S3_*` vars → redeploy → organiser uploads work.
7. ICO registration + DPIA + solicitor review of the legal pages.
8. **The next native build.** Social sign-in shipped 2026-08-27. Push
   notifications and the QR scanner are now built and deployed server-side,
   but **neither can reach a device without a new binary** — both need native
   modules, and EAS Update ships JavaScript only. What is waiting:
   - **Push notifications.** All four triggers are live on the API: RSVP
     confirmation, host announcements, event reminders (Vercel cron, every 30
     minutes, needs `CRON_SECRET`), and new-event alerts to people who
     attended that host in the last 12 months. Cancellations notify ticket
     holders too. The client registers a token after an RSVP — the one moment
     where asking for permission explains itself, and iOS grants exactly one
     prompt per install.
   - **The QR scanner.** Uses the check-in API that already existed.
   - Universal links on `ekklesiaevents.com`, if the `ekklesia://` scheme is
     ever to be replaced.

   Both are gated on `requireOptionalNativeModule`, so on the current build the
   buttons are simply absent rather than crashing — which reads as "the feature
   is missing" rather than as a bug.

   **New-event alerts stand in for following a host.** Phase B (follows) is
   still deferred, so they key off past attendance with a 12-month window.
   When follows land, that should key off them and the window can go.

   Remember the dividing line: EAS Update ships JavaScript, so anything
   needing a native module waits for a build. That is what kept the sign-in
   buttons hidden until 27 August — `canUseSocialSignIn()` found no
   `ExpoWebBrowser` in a binary predating the dependency, and withheld the
   buttons rather than crashing on tap.
9. Stripe — see section 10.

### Future: announcement delivery report

When a host sends an announcement, email them a short summary afterwards:
how many attendees it reached, how many devices accepted it, and how many
could not be delivered.

Worth doing because the send is deliberately opaque right now. `PushService`
swallows failures by design, so a host who messages 40 attendees and reaches 12
has no way to know. The numbers already exist — `announce()` returns
`recipients` and `sent`, and they differ for real reasons: people with
notifications off, tokens retired as `DeviceNotRegistered`, attendees who have
never opened the app on a phone.

Two things to get right when building it. The report should explain the gap
rather than just state it, or "sent to 12 of 40" reads as a bug. And it should
be honest that Expo's ticket only means *accepted for delivery* — the receipt
that confirms the device actually got it is fetched separately, about a day
later, which is a second job if the number needs to be true rather than
indicative.

Items 1–4 are what separate "works when I am watching" from "runs without me".

---

### Domain migration — ekklesiaevents.com (done)

Completed. Web sign-in works on the new domain. Recorded here because the
reasoning matters if the hostnames ever move again.

The domain was not only an email dependency — it is what fixed web sign-in in
Safari.

**Why.** Cookies are scoped by *registrable domain*, not by origin. Before the
move, the web app and the API shared only `vercel.app`, which is on the Public
Suffix List — so the browser counted them as different **sites** and the session
cookie was third-party. `SameSite=None; Secure` worked around it for Chrome,
Edge and Firefox, but Safari blocks third-party cookies outright (on iOS that
means every browser, since they all use WebKit). Now that both hostnames share
`ekklesiaevents.com` the cookie is first-party and the setting is back to
`Lax`.

**Hostname → project.** A domain is not assigned to one project; each hostname
is added to a project and Vercel routes by hostname.

| Hostname | Vercel project | Role |
| --- | --- | --- |
| `ekklesiaevents.com` | ekklesia-web | the site (canonical) |
| `www.ekklesiaevents.com` | ekklesia-web | 307 redirect to the apex |
| `api.ekklesiaevents.com` | ekklesiabackend | the API |

The apex is the canonical origin and every URL below uses it. If the primary
is ever flipped to `www` in Vercel, swap these values consistently — a
`WEB_URL` that only ever redirects produces links with a needless hop and an
origin that never matches what the browser sends.

Which one is primary makes no difference to the cookie problem: the apex and
`api.` share the registrable domain either way, which is the only thing
`SameSite` cares about.

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
   | `TRUSTED_ORIGINS` | `https://ekklesiaevents.com,https://www.ekklesiaevents.com` |
   | `WEB_URL` | `https://ekklesiaevents.com` |

   The old `*.vercel.app` web origin is deliberately absent — keeping it is what
   would have kept `SameSite=None` necessary. The consequence is that the old
   web URL is CORS-blocked, which is the intended end state.

   **Web project:**

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_API_URL` | `https://api.ekklesiaevents.com` |
   | `NEXT_PUBLIC_WEB_URL` | `https://ekklesiaevents.com` |

   `TRUSTED_ORIGINS` drives both CORS (`bootstrap.ts`) and Better Auth's origin
   check, so it must list every origin the browser actually uses. Redeploy both
   projects afterwards — `NEXT_PUBLIC_*` is inlined at build time, so the web
   app will not pick up a new value without one.

3. In the Google Cloud console, add `https://api.ekklesiaevents.com/auth/callback/google`
   to the OAuth client's authorised redirect URIs. Leave the existing
   `*.vercel.app` URI in place until the migration is confirmed.

4. Verify: sign in on `https://ekklesiaevents.com` in **Safari**. That is the
   case that fails today, so it is the one worth checking.

5. Only then, in the repo: point mobile at the new API (`apps/mobile/eas.json`,
   both profiles, and the `ota:prod` script in `apps/mobile/package.json`), and
   publish with `pnpm run ota:prod`. Never a bare `eas update` — the script
   pins the public URLs, and a bare update once baked a LAN IP into production.

6. Housekeeping, done: the `*.vercel.app` web origin is out of
   `TRUSTED_ORIGINS`, and `advanced.defaultCookieAttributes` is gone from
   `apps/api/src/modules/auth/auth.ts` so cookies sit at Better Auth's
   `SameSite=Lax` default again. Still outstanding: delete the old
   `*.vercel.app` redirect URI from the Google OAuth client, which is now
   unused — `BETTER_AUTH_URL` only ever produces the `api.` one.

Both projects keep their `*.vercel.app` hostnames, so old mobile installs
survived the move. They are no longer a fallback for the web app, though:
its origin is out of `TRUSTED_ORIGINS` and `Lax` would block the cookie
anyway.

Deep links still use the `ekklesia://` scheme. Universal links on
`ekklesiaevents.com` are a separate piece of native work; batch them with push
notifications rather than doing them here.

## 9. Social sign-in — Google, Apple, Microsoft

**Status: Google and Apple are live** on web, iOS and Android as of
2026-08-27. Microsoft remains unconfigured and optional. What follows is the
setup record, kept because the failure modes were expensive to find.

**One thing worth knowing if the Apple key is ever rotated.** Better Auth does
not build Apple's client secret at 1.6.11 — `AppleOptions` takes `clientId`,
`appBundleIdentifier` and `audience`, and inherits a required `clientSecret`.
Give it a team id and private key and it ignores them silently, then fails
every sign-in with `CLIENT_ID_AND_SECRET_REQUIRED`. `social-providers.ts`
mints the ES256 assertion itself. If a future upgrade starts building it, that
code should go — but check, do not assume.

**And a diagnostic dead end, so nobody repeats it.** Apple validates the
authorization code *before* the client credentials, so a token exchange with a
fake code returns `invalid_grant` even when the credentials are entirely
wrong. There is no way to test an Apple credential set without a real
sign-in — not via the token endpoint, not via `/auth/revoke`. If sign-in fails
with `invalid_client`, check the four values against the portal; do not try to
probe Apple for an answer.


The server side is built and deployed. Each provider switches itself on only
when its credentials are present, so nothing changes until you create them, and
a half-configured provider is left out rather than offering a button that
dead-ends. `GET /v1/config` reports which are live; the web sign-in and sign-up
pages render buttons from that list and show nothing when it is empty.

**What only you can create** (they are accounts and signing keys):

*Google* — Google Cloud Console → APIs & Services → Credentials → OAuth client
ID (Web application). Authorised redirect URI:
`https://api.ekklesiaevents.com/auth/callback/google`.
Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.

*Microsoft (Outlook)* — Entra ID → App registrations → New registration, with
"Accounts in any organizational directory and personal Microsoft accounts" so
Outlook.com addresses work. Redirect URI (type Web):
`https://api.ekklesiaevents.com/auth/callback/microsoft`.
Set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`; `MICROSOFT_TENANT_ID`
defaults to `common`.

*Apple* — the fiddliest of the three, because it needs four pieces of identity
rather than a client id and secret, and it will not work until Apple has
verified the domain. In the developer portal:

1. **Identifiers → your App ID** → enable the *Sign In with Apple* capability.
2. **Identifiers → + → Services IDs.** This is the OAuth client id, *not* the
   app bundle id — something like `com.ekklesiaevents.web`. Enable *Sign In
   with Apple* on it and hit **Configure**:
   - Primary App ID: the App ID from step 1
   - Domains and Subdomains: `api.ekklesiaevents.com`
   - Return URLs: `https://api.ekklesiaevents.com/auth/callback/apple`
3. Apple offers a **domain association file** in that dialog. Download it and
   put its contents in `APPLE_DOMAIN_ASSOCIATION` on the API project, then
   redeploy. It is then served at
   `https://api.ekklesiaevents.com/.well-known/apple-developer-domain-association.txt`
   (see `apple-domain.controller.ts`), which is where Apple looks — the route
   is excluded from the `/v1` prefix for exactly that reason. Redeploy *before*
   pressing Verify, or verification fails and has to be retried.
4. **Keys → +** → enable *Sign In with Apple*, pick the same primary App ID,
   and download the `.p8`. **Apple lets you download it once.** Note the Key ID
   shown next to it.
5. Team ID is on the Membership page.

Then set, on the API project:

| Variable | Where it comes from |
| --- | --- |
| `APPLE_CLIENT_ID` | the Services ID from step 2 |
| `APPLE_TEAM_ID` | Membership page |
| `APPLE_KEY_ID` | the key from step 4 |
| `APPLE_PRIVATE_KEY` | the `.p8` contents; `\n` escapes are un-escaped for you |
| `APPLE_BUNDLE_ID` | `com.ekklesia` — the native flow only |
| `APPLE_DOMAIN_ASSOCIATION` | the file from step 3 |

Apple's "client secret" is a short-lived JWT signed with that key rather than a
static string; Better Auth builds it from the four values, which is why there is
no `APPLE_CLIENT_SECRET`.

**Private Email Relay — do this when Resend is set up.** Apple's setup banner
lists a fourth step, *Register Email Sources for Communication*, and it is not
optional for us. Anyone who signs in with "Hide My Email" gives us a
`@privaterelay.appleid.com` address, and Apple **silently drops** mail sent to
it from a domain that has not been registered under the Services ID's
configuration. The failure mode is the worst kind: password resets to those
users vanish with no bounce and no error on our side, and only that subset of
users is affected, so it looks like a flaky mailer rather than a
misconfiguration.

It cannot be done until there is a verified sending domain, so it belongs with
the Resend step: register `ekklesiaevents.com` (and the exact `EMAIL_FROM`
address) as an email source, then test a password reset against a Hide My Email
account before trusting it.

One trap that is already handled: Apple returns the callback as a cross-site
`POST` (`response_mode=form_post`), and a `SameSite=Lax` cookie is not sent on
one of those. Better Auth's callback accepts the POST and immediately redirects
to itself as a GET, which is a same-site top-level navigation, so the state
cookie is sent on the second hop. No configuration needed — but if Apple ever
fails with a state error while Google works, that mechanism is where to look.

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

---

## 11. Object storage — Backblaze B2

Live since 2026-09-02. The code talks to a configurable S3-compatible endpoint,
so B2 needed no code changes — only the six `S3_*` variables.

**Two mistakes cost real time getting here, both worth knowing.**

*The endpoint needs a scheme.* Backblaze prints it as
`s3.<region>.backblazeb2.com`, and pasting that verbatim made the AWS SDK throw
a bare `TypeError: Invalid URL` from inside its endpoint resolver — naming no
variable and never mentioning storage. `uploads.service.ts` now adds `https://`
if it is missing and validates the endpoint at construction, so a bad value says
which variable is wrong instead of producing a stack trace on first upload.

*`S3_PUBLIC_BASE` is the storage host, not the website.* It was briefly set to
`ekklesiaevents.com`, which built image URLs pointing at the Next.js app —
uploads succeeded and every image 404'd. It must be the B2 endpoint, or left
unset so it falls back to it. The URL is assembled as
`{S3_PUBLIC_BASE}/{bucket}/{key}`, so the value must not already contain the
bucket.

**The bucket must be public.** B2 creates buckets private, and a private bucket
serves a presigned upload perfectly well while refusing the plain public URL we
then store — so the upload looks fine and the image never appears.

**Still worth doing:** put a CDN in front on `images.ekklesiaevents.com`.
Backblaze has a bandwidth agreement with Cloudflare that makes egress free
through it, and a custom domain means storage can move later without stranding
every image URL already written to the database. Doing it before there are
hundreds of images is much cheaper than after — `S3_PUBLIC_BASE` is baked into
every stored URL at upload time.

## 12. Moderation — reporting, blocking and the queue

Apple guideline 1.2 requires four things of an app carrying user-generated
content: a filter, a way to report, a way to block, and acting on reports in a
timely way. All four now exist.

- **Filter** — `packages/shared/src/content-filter.ts`, applied on event create
  and update.
- **Report** — `POST /v1/reports`, from an event page or a host page in the app.
- **Block** — `/v1/me/blocks`, undone from Settings → Blocked.
- **Queue** — `/admin/reports`, gated on `PLATFORM_MODERATOR` or above.

The Terms commit us to reviewing every report and acting on objectionable
content within 24 hours. The queue is ordered oldest-first for that reason, and
marks anything past 24 hours.

**Nobody can open the queue in production yet.** The seed creates a platform
admin only when `NODE_ENV !== 'production'`, so on Neon every account is still
`USER` and the queue refuses everyone.

Two steps, in order. First **sign up normally** at ekklesiaevents.com with the
address the moderator will use — there is deliberately no way to create an admin
account from a script, because one made outside signup has no password, no
verified email and no audit trail. Then grant the role:

```bash
DATABASE_URL='<neon production url>' \
  pnpm --filter @ekklesia/api grant-role -- david@ekklesiaevents.com
```

It runs from any directory in the repo. The script prints the database host before it writes, so a grant aimed at
production cannot silently land on localhost. It refuses unknown roles, says so
when the account does not exist, takes `--dry-run`, and writes an audit row for
the change. The same script adds moderators later:

```bash
DATABASE_URL='<neon production url>' \
  pnpm --filter @ekklesia/api grant-role -- sam@example.com PLATFORM_MODERATOR
```

**Set `MODERATION_EMAIL`,** or nothing tells anyone a report was filed. Its
absence is logged as an error rather than a warning for that reason.

### platformRole is not on the session

`CurrentUserService` reads `platformRole` from the Better Auth session, but the
field was never declared in Better Auth's `user.additionalFields` — so it always
read as `USER`. Two consequences:

1. `PlatformRoleGuard` reads the role from the database instead. That is also
   the right call on its own merits: a role cached in a session means revoking
   someone's admin access would not take effect until their session refreshed.
2. **`OrgMembershipGuard`'s platform-admin bypass has never worked** — the check
   at `apps/api/src/common/org-membership.guard.ts:96` cannot fire, and
   `@RequirePlatformRole` on any org-scoped route would always 403. Nothing uses
   it today, so nothing is broken; it is left alone deliberately, because
   "fixing" it would silently hand platform admins write access to every
   organisation, which is a decision rather than a bug fix.

### What the queue cannot do yet

Takedown unpublishes an event (back to `DRAFT`) — reversible, and it does not
email attendees the way cancelling does. There is **no account suspension**:
neither `User` nor `Organization` has a `suspendedAt`, so the Terms' "suspending
or permanently ejecting the account responsible" is currently a manual
operation. Adding it means a migration plus an enforcement check on every
authenticated request, which is worth doing deliberately rather than in a rush
before launch.

The admin nav also links to Organizations, Users, Feature flags and Audit log,
none of which exist yet. `/admin` itself has no route-level gate — the API
refuses the data, so nothing leaks, but the shell renders for anyone.
