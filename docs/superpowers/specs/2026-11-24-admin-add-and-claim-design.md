# Admin: add events for churches, and let them claim

Date: 2026-11-24 · Status: draft for approval

## Why

Every event on ekklesiaevents.com has already happened, so the home page and
Discover are empty. Waiting for churches to sign up one by one is too slow.
Staff will add real upcoming events on a church's behalf; the church gets an
email inviting it to claim its page and take over (RSVPs, check-in, edits).

Success: staff can put a real church and its upcoming events live in a few
minutes, and the church's contact can claim the page from one email without
contacting us.

## Goals

- Staff-only console (from `~/Downloads/ek-admin-handover`), first slice:
  staff sign-in, shell, Hosts, Events, and the add-and-claim flow.
- Add an event for a church that is not on Ekklesia yet, creating the church
  page in the same step. Add more events to an unclaimed church later.
- Church page and events go **live straight away**.
- Claim email to the church's contact; claiming makes them the owner.
- A "This isn't us / take it down" link in the email.
- Every staff action is written to the existing `AuditLog`.

## Non-goals (this slice)

Verification queue, Reports screen redesign, Users, Payments, Settings,
Overview, Google Workspace staff sign-in, ⌘K global search, notifications
bell, bulk event actions, featured star, "first three events need review".
These follow later, one at a time, in the order the handover suggests.

## Anti-goals

- A church being listed with no way to object, or an objection that needs a
  human to act before the page comes down.
- Staff able to act without a second factor.
- A claim link that lets someone other than the named contact take over a
  church (link goes only to the contact email; whoever holds it becomes owner).
- Breaking existing hosts, the public site, or the mobile app's auth.

## Constraints (from the project)

- API: NestJS + Prisma + Better Auth 1.6.11 (`bearer`, `oneTimeToken`
  plugins; email/password with required verification; Google/Apple social).
- `User.platformRole` exists: USER, PLATFORM_SUPPORT, PLATFORM_MODERATOR,
  PLATFORM_ADMIN. `PlatformRoleGuard` + `@RequirePlatformRole` gate `/admin`.
- `AuditLog` model and `AuditLogService.write()` exist.
- `EventsService.create(orgId, actorUserId, body)` and `publish(eventId,
  actorUserId)` already do the event work and audit; reuse them.
- `Organization.contactName/contactEmail` already exist (not public).
- Email via Resend (`EmailService.send`), templates in `modules/email/templates`.
- Web: Next 15 App Router, Tailwind tokens; existing `(admin)` group has
  Overview + Reports in the public-site shell, to be replaced by the console
  shell. Handover says dark by default, both themes, 4.5:1 contrast, phone
  layout at ≤760px, sidebar collapses ≤900px.
- Schema changes need the user's approval before migrating.

## Approaches considered

1. **Add-and-claim first (picked).** Staff sign-in + shell + audit, then
   Hosts and Events, then the add-and-claim flow. Gets real events live
   soonest; the rest of the console follows.
2. Build the handover in its own order (10 steps). Add-and-claim lands last;
   the site stays empty far longer.
3. Script/seed events directly in the database. Fast, but no claim flow,
   no audit, no way for churches to object; rejected.

## Design

### Staff sign-in (`/admin/sign-in`)

- Matches Admin-SignIn design, minus the Google Workspace button for now.
- Step 1 email + password (Better Auth). Step 2 a 6-digit TOTP code, with
  "Trust this device for 7 days" and backup codes — Better Auth `twoFactor`
  plugin.
- Only users with a staff platform role can enter `/admin/*`; a staff user
  without 2-step set up is sent to a set-up step and blocked until done.
- Lockout after 5 failed attempts for 15 minutes; every staff sign-in written
  to `AuditLog` with IP and user agent.
- **Only `@ekklesiaevents.com` addresses** can hold a staff role or sign in
  to `/admin` — no allow-list or exceptions (user's decision). The API
  refuses to grant a staff role to any other address.
- First super admin is created with a one-off CLI command
  (`pnpm --filter @ekklesia/api admin:grant <email>`) that only accepts an
  `@ekklesiaevents.com` address; they set up the 6-digit code at first
  sign-in. Existing staff-role accounts outside the domain lose console
  access (their role is reported by the command, not silently deleted).

### Console shell

- `/admin` route group with its own layout (AdminNav + AdminTop from the
  handover, `admin.css` classes ported to the existing token system). No
  public header/footer. Nav shows only screens that exist in this slice
  (Overview placeholder → Hosts, Events, Reports existing page restyled into
  the shell); others are added as they are built.

### Hosts (`/admin/hosts`, `/admin/hosts/[hostId]`)

- Admin-Hosts / Admin-HostDetail designs, with a new status **Unclaimed**
  (and Claimed / Taken down) shown as a `.st` pill alongside verification.
- Unclaimed host: "Resend claim email", "Change contact email", and
  "Add event" actions. Host detail tabs in this slice: Overview and Events;
  others later.

### Events (`/admin/events`)

- Admin-Events design: status tabs (All, Live, Ended, Unpublished; "Needs
  review" / "Reported" / "Featured" later), search, table → card list on
  phones. Unpublish with a confirm dialog.

### Add event for a church (new, undrawn — built in the console's style)

- Button "Add event for a church" on Events and Hosts (and "Add event" on an
  unclaimed host's page).
- Step 1 **Church**: pick an existing unclaimed church, or create one: name,
  type (Church / Ministry / Community), area/city, country, contact name,
  contact email. Warn if a church with a similar name or that email exists.
- Step 2 **Event**: the same fields as the host event form (reuse the
  organiser event form component where practical). **Free events only**
  while the church is unclaimed: it has no Stripe account or owner, and paid
  tickets are off in production anyway. Enforced on the API.
- Save: in one transaction create the organisation (owned by nobody yet,
  `claimStatus = UNCLAIMED`), create the event via `EventsService.create`
  and `publish`, audit `admin.host.create` and `admin.event.create`.
  Claim email is sent when the church is first created (not per event).
- Public church and event pages show a small "Added by Ekklesia — is this
  your church? Claim it" note while unclaimed.

### Claim

- Email "Your church's events are on Ekklesia" to the contact email, with
  **Claim your page** and **This isn't us / take it down** links.
- Claim link opens `/claim/[token]`: shows the church and its events, then
  "Set a password" or "Continue with Google" for that same email.
  - No account for that email: create the user on claim (email counts as
    verified because they clicked a link sent to it), add an `OWNER`
    membership (same role normal host sign-up creates), mark claimed, sign them in, go to the host
    dashboard.
  - Existing account: sign in as usual, then add the membership.
- Token: single-use, random, stored hashed, expires in **7 days**; resending
  issues a new token and invalidates the old one. Expired link explains and
  offers to email a fresh one to the same address.
- RSVPs taken before the claim are kept; the owner sees them all.
- Audit `host.claim`.

### Take down

- The take-down link carries its **own** token, separate from the claim
  token (builder's call): it does not expire while the church is unclaimed,
  survives claim-email resends, and stops working the moment the church is
  claimed (from then on the owner controls the page). This keeps a way to
  object open for as long as the church is listed without its say-so.
- "This isn't us" link opens a page confirming the church name, an optional
  reason, and a **Take it down** button.
- Doing so immediately unpublishes the church's events and hides its page
  (`claimStatus = DISPUTED`), audits `host.disputed`, and flags it for staff
  in the Hosts list (filter "Taken down"). People already booked get the
  existing event-cancelled handling, which emails them (handover: bookers
  are emailed when an event is unpublished). No refunds arise because
  unclaimed churches can only have free events (below).
- Staff can restore it (with a confirm dialog) after checking.

### Who can do what (builder's call, from the handover role table)

- Add a church and events, resend the claim email, change the contact email,
  restore a taken-down church, unpublish: Super admin and Moderator.
- Support: read-only on Hosts and Events in this slice. Finance: no access
  to these screens yet. Checked on the server for every endpoint.

### Verification status

- Staff-added churches start **UNVERIFIED**, and claiming does not change
  that (user's decision: verification must be in-depth and thought through,
  so it is earned only through the full verification review, a later slice).
- Being added by staff is shown as "Added by Ekklesia", never as a
  verified badge.

### Data model changes (to approve before migrating)

- `Organization.claimStatus` enum `CLAIMED | UNCLAIMED | DISPUTED`, default
  `CLAIMED` (existing hosts unaffected); `claimedAt`, `addedByUserId`.
- `OrganizationClaim` table: `id, organizationId, email, tokenHash,
  expiresAt, usedAt, createdByUserId, createdAt`.
- `PlatformRole` gains `PLATFORM_FINANCE` (handover role table).
- Better Auth `twoFactor` plugin tables/columns (generated by its schema).

## Left to the builder

- Exact component split, file layout, Tailwind vs `admin.css` port.
- Wording of the claim / take-down emails and pages, in the site's voice.
- Duplicate-detection matching rules.
- How the "Added by Ekklesia" note looks, within the public design.
- Rate limiting on the public claim / take-down endpoints.
