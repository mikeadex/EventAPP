# Admin add-and-claim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff (only `@ekklesiaevents.com`, with 2-step codes) add live events for churches not yet on Ekklesia; the church's contact gets an email to claim the page or take it down.

**Architecture:** NestJS `admin` module gains host/event endpoints and reuses `EventsService.create/publish/cancel`; a new `claims` module owns single-use hashed tokens and the public claim / take-down endpoints. Better Auth gets the `twoFactor` plugin. Web gets a new `/admin` console shell from `~/Downloads/ek-admin-handover`, plus public `/claim/[token]` and `/takedown/[token]` pages.

**Tech Stack:** NestJS 10, Prisma 5 (Postgres), Better Auth 1.6.11, Resend, Next 15 App Router, Tailwind 3 tokens, Jest (ts-jest) for API.

**Spec:** `docs/superpowers/specs/2026-11-24-admin-add-and-claim-design.md`
**Design reference:** `~/Downloads/ek-admin-handover/HANDOFF.md`, `styles/admin.css`, `designs/**/*.dc.html`

## Global Constraints

- Staff = `platformRole` ≠ `USER` **and** email ends with `@ekklesiaevents.com` (case-insensitive) **and** `twoFactorEnabled`. No allow-list.
- Lockout: 5 failed staff sign-ins → locked 15 minutes. Every staff sign-in audited with IP + user agent.
- Claim token: random 32 bytes, stored as SHA-256 hex, single use, expires **7 days**; resend voids older claim tokens.
- Take-down token: separate, no expiry while `claimStatus = UNCLAIMED`, survives resends, invalid once claimed.
- Unclaimed churches: free events only (every ticket type `priceMinor = 0`), enforced on the API.
- Staff-added churches start `verificationStatus = UNVERIFIED`; claiming does not change it.
- Claimer gets `OrgRole.OWNER`.
- Roles: add church/event, resend, change contact, restore, unpublish → `PLATFORM_MODERATOR` and up. Hosts/Events read → `PLATFORM_SUPPORT` and up. `PLATFORM_FINANCE` ranks as a peer of SUPPORT for read gates only when it is explicitly listed; this slice lists it nowhere.
- Every staff mutation writes `AuditLog` (`admin.host.create`, `admin.event.create`, `admin.claim.resend`, `admin.host.contact`, `admin.host.restore`, `admin.event.unpublish`, `staff.signin`, `staff.signin.failed`); public ones write `host.claim`, `host.disputed`.
- UI: tokens only, dark default + light, ≥4.5:1 contrast, sidebar row ≤900px, card lists ≤760px, 44px tap targets, confirm dialog for unpublish and restore.
- **Mobile apps must not break** (user's requirement). The iOS/Android app (`apps/mobile`) uses the same API with Better Auth bearer tokens and parses plain JSON:
  - Schema changes are additive only (new columns with defaults, new tables, new enum values); no column, field, route or response shape the app uses is renamed, removed or retyped.
  - New routes only under `/v1/admin/*`, `/v1/claims/*`, `/v1/takedown/*`; existing routes only gain fields.
  - `twoFactor` can be enabled only by staff (a `hooks.before` on `/two-factor/enable` returns 403 for non-staff), so sign-in for every app user is unchanged. Staff accounts with 2-step cannot sign in to the app (it has no code step) — acceptable, they are admin-only accounts.
  - Lockout and sign-in hooks act only on staff-role users and never change the response for anyone else (bearer `set-auth-token` header included).
  - A taken-down (DISPUTED) church is hidden from discovery and its host page, but its cancelled events still open by direct link, so tickets already in the app keep opening.
  - Task 13 runs the mobile typecheck and replays the app's sign-in over bearer against the local API.
- Schema changes: show the generated SQL to the user and **wait for approval** before `prisma migrate dev`.

## Review Focus

1. Claim with a password for an email that already has an account → must not create a duplicate; tell them to sign in, then attach (Task 7 test `password claim for existing email returns 409 SIGN_IN`).
2. Claim link opened twice / after resend → second use and old links get "link used or replaced", never a second owner (Task 6 tests `consume twice`, `resend voids old`).
3. Signed in with Google under a different email than the claim email → refuse attach (Task 7 test `attach rejects mismatched email`).
4. Take-down link used after the church was claimed → refused, page stays up (Task 7 test `takedown after claim is 410`).
5. Staff add a church whose contact email or name already exists → warn, never silently create a second page for the same contact (Task 8 test `duplicate contact email returns matches`).
6. An ordinary app user signs in from the mobile app after the twoFactor plugin is installed → identical response, `set-auth-token` header present, no `twoFactorRedirect` (Task 3 test `non-staff sign-in response unchanged`).

---

### Task 1: Schema changes (stop for approval)

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (enums near line 61 and 194, `Organization` ~132, `User` ~26)
- Create: `apps/api/prisma/migrations/<timestamp>_admin_add_and_claim/migration.sql` (generated)

**Interfaces:**
- Produces: `enum ClaimStatus { CLAIMED UNCLAIMED DISPUTED }`; `Organization.claimStatus ClaimStatus @default(CLAIMED)`, `claimedAt DateTime?`, `addedByUserId String?` (+ relation to `User`), `@@index([claimStatus])`; `enum ClaimTokenKind { CLAIM TAKEDOWN }`; `model OrganizationClaimToken { id, organizationId, kind ClaimTokenKind, email String, tokenHash String @unique, expiresAt DateTime?, usedAt DateTime?, revokedAt DateTime?, createdByUserId String?, createdAt }` with `@@index([organizationId, kind])`; `PlatformRole.PLATFORM_FINANCE`; `User.twoFactorEnabled Boolean @default(false)`, `User.failedSignIns Int @default(0)`, `User.lockedUntil DateTime?`, and `model TwoFactor { id, secret, backupCodes, userId → User }` exactly as `npx @better-auth/cli generate` outputs for the `twoFactor` plugin.

- [ ] **Step 1:** Edit the schema as above. Run `npx -y pnpm@11.3.0 --filter @ekklesia/api exec prisma migrate dev --create-only --name admin_add_and_claim`. Expected: one new migration folder, nothing applied.
- [ ] **Step 2:** Show the user the migration SQL. **Stop until they approve.**
- [ ] **Step 3:** Run `npx -y pnpm@11.3.0 --filter @ekklesia/api exec prisma migrate dev` then `... db:generate`. Expected: "Your database is now in sync".
- [ ] **Step 4:** `npx -y pnpm@11.3.0 --filter @ekklesia/api typecheck` passes. Commit `feat(api): schema for admin add-and-claim`.

### Task 2: Staff identity rule, role rank, grant script

**Files:**
- Create: `apps/api/src/common/staff.ts`, `apps/api/src/common/staff.spec.ts`
- Modify: `apps/api/src/common/platform-role.guard.ts` (RANK, staff check), `apps/api/scripts/grant-platform-role.mjs`

**Interfaces:**
- Produces: `STAFF_DOMAIN = 'ekklesiaevents.com'`; `isStaffEmail(email: string): boolean`; `staffBlockReason(u: { email: string; platformRole: string; twoFactorEnabled: boolean }): 'NOT_STAFF' | 'WRONG_DOMAIN' | 'NEEDS_2FA' | null`. Guard throws `ForbiddenException({ code })` with that reason; `RANK.PLATFORM_FINANCE = 1`.

- [ ] **Step 1: Failing tests** in `staff.spec.ts`:
  - `isStaffEmail('David@EkklesiaEvents.com')` → `true`; `'a@ekklesiaevents.com.evil.io'` → `false`; `'a@sub.ekklesiaevents.com'` → `false`.
  - `staffBlockReason({email:'x@gmail.com', platformRole:'PLATFORM_ADMIN', twoFactorEnabled:true})` → `'WRONG_DOMAIN'`; USER → `'NOT_STAFF'`; staff domain without 2FA → `'NEEDS_2FA'`; all good → `null`.
- [ ] **Step 2:** `npx -y pnpm@11.3.0 --filter @ekklesia/api test -- staff` → FAIL (module missing).
- [ ] **Step 3:** Implement `staff.ts`; guard calls `staffBlockReason` after loading the user (select `email`, `platformRole`, `twoFactorEnabled`).
- [ ] **Step 4:** Tests pass.
- [ ] **Step 5:** Script: add `PLATFORM_FINANCE` to `ROLES`; refuse any non-USER role for an email failing the same domain rule (exit 1, message "Staff roles are only for @ekklesiaevents.com addresses"); add `--list-offdomain` that prints staff-role accounts outside the domain without changing them. Dry-run it locally.
- [ ] **Step 6:** Commit `feat(api): staff must be @ekklesiaevents.com with 2-step`.

### Task 3: Two-factor, lockout and sign-in audit

**Files:**
- Modify: `apps/api/src/modules/auth/auth.ts` (plugins ~192, hooks)
- Create: `apps/api/src/modules/auth/staff-signin.ts`, `apps/api/src/modules/auth/staff-signin.spec.ts`
- Modify: `apps/web/src/lib/auth-client.ts` (add `twoFactorClient()`)

**Interfaces:**
- Produces: Better Auth `twoFactor({ issuer: 'Ekklesia Admin' })` (endpoints `/auth/two-factor/*`; trust-device is the plugin's 7-day `trustDevice`). `recordSignInAttempt(prisma, email: string, ok: boolean, now: Date): Promise<{ locked: boolean; lockedUntil: Date | null }>` — applied only to staff-role users via a `hooks.before`/`after` on `/sign-in/email`; a locked staff account gets 423 `{ code: 'LOCKED', lockedUntil }`.

- [ ] **Step 1: Failing tests** (`staff-signin.spec.ts`, Prisma mocked): `non-staff sign-in response unchanged` (hook is a no-op for USER: no lock, no 423, no extra fields); `non-staff cannot enable two-factor` (403); 5th failure within lock window sets `lockedUntil = now + 15 min` and `locked: true`; success resets `failedSignIns` to 0; a non-staff user is never locked.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; hooks write `staff.signin` / `staff.signin.failed` audit with `req`.
- [ ] **Step 4:** Tests pass; `typecheck` passes; start API, `curl -X POST localhost:4000/auth/sign-in/email` with a wrong password 5× for a staff test account → 6th returns 423.
- [ ] **Step 5:** Commit `feat(api): two-factor and lockout for staff sign-in`.

### Task 4: Console shell and shared admin components (web)

**Files:**
- Create: `apps/web/src/app/admin/(console)/layout.tsx`, `apps/web/src/components/admin/{admin-nav,admin-top,status-pill,kpi-card,tabs,confirm-dialog,data-table}.tsx`, `apps/web/src/app/admin/admin.css` (port of handover `styles/admin.css` onto existing tokens; `--ok`/`--warn` admin-only)
- Move: `apps/web/src/app/(admin)/admin/reports/*` → `apps/web/src/app/admin/(console)/reports/`; `(admin)/admin/page.tsx` → `admin/(console)/page.tsx` (placeholder "Overview is coming" until its slice); delete `(admin)/layout.tsx`.
- Create: `apps/web/src/lib/admin-api.ts`

**Interfaces:**
- Produces: `<AdminNav active="overview"|"hosts"|"events"|"reports" counts={{reports?: number}} />` (only these four links this slice); `<StatusPill tone="default"|"ok"|"warn"|"bad">text</StatusPill>`; `<ConfirmDialog open title body confirmLabel tone="bad"|"default" onConfirm onCancel />` (native `<dialog>`, focus trapped, Esc cancels); `<Tabs items={{key,label,count?}[]} param="status" />` writing to the URL; `adminApi<T>(path, init?)` = `apiClient` with `/v1/admin` prefix. Layout is a client-checked guard: on 401/403 from `GET /v1/admin/me` redirect to `/admin/sign-in?next=…`, on `code: 'NEEDS_2FA'` to `/admin/sign-in?step=setup`.
- Consumes: API `GET /v1/admin/me` → `{ id, name, email, platformRole }` (add to `AdminController` in this task, `@RequirePlatformRole('PLATFORM_SUPPORT')`).

- [ ] **Step 1:** Build components to AdminNav/AdminTop designs (no ⌘K search, no bell this slice; env pill from `NEXT_PUBLIC_ENV`; theme toggle reuses `ek-theme`).
- [ ] **Step 2:** Verify in preview: `/admin/reports` renders inside the shell for the local admin; signed-out → `/admin/sign-in`. Sweep 375 and 1280, both themes: no overflow, no contrast failures.
- [ ] **Step 3:** Commit `feat(web): admin console shell`.

### Task 5: Staff sign-in page (web)

**Files:**
- Create: `apps/web/src/app/admin/sign-in/page.tsx`, `apps/web/src/app/admin/sign-in/sign-in-flow.tsx`

**Interfaces:**
- Consumes: `authClient.signIn.email`, `authClient.twoFactor.verifyTotp({ code, trustDevice })`, `.verifyBackupCode`, `.enable({ password })` (returns `totpURI`, `backupCodes`), `GET /v1/admin/me`.

- [ ] **Step 1:** Build to Admin-SignIn design without the Google button. Steps: credentials → code (6 boxes, paste fills all, "Trust this device for 7 days", backup-code link) → or `?step=setup`: QR of `totpURI` (reuse existing QR component), backup codes shown once, confirm with a code. Non-staff after sign-in → "This account doesn't have staff access" and sign out. 423 → "Locked until HH:MM".
- [ ] **Step 2:** Verify in preview with a local `@ekklesiaevents.com` test admin (created via `grant-role`; credentials recorded in the scratchpad test-account file, not chat): setup → sign out → sign in with code → lands on `/admin`. Phone width check.
- [ ] **Step 3:** Commit `feat(web): staff sign-in with 2-step`.

### Task 6: Claim token service

**Files:**
- Create: `apps/api/src/modules/claims/claim-tokens.service.ts`, `claim-tokens.service.spec.ts`, `claims.module.ts`

**Interfaces:**
- Produces:
  - `issue(tx, { organizationId, email, kind: 'CLAIM'|'TAKEDOWN', createdByUserId }): Promise<string>` (returns raw token; CLAIM revokes earlier unrevoked CLAIM tokens for that org; TAKEDOWN reuses nothing — issue only once per org; `expiresAt` = now + 7 days for CLAIM, `null` for TAKEDOWN).
  - `peek(raw, kind): Promise<{ token, organization } | { error: 'INVALID'|'USED'|'EXPIRED'|'CLAIMED' }>`.
  - `consume(tx, raw, kind): Promise<OrganizationClaimToken>` (atomic `updateMany where usedAt null and revokedAt null` → 0 rows throws `GoneException('USED')`).
  - `hashToken(raw: string): string` (SHA-256 hex).
- [ ] **Step 1: Failing tests** (Prisma mocked or test DB, follow `zod-exception.filter.spec.ts` style): `consume twice` → second throws USED; `resend voids old` → old CLAIM peeks `USED`; CLAIM after 7 days + 1s → `EXPIRED`; TAKEDOWN when org `claimStatus = CLAIMED` → `CLAIMED`; stored value never equals raw token.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement with `crypto.randomBytes(32).toString('base64url')`. **Step 4:** Pass. **Step 5:** Commit `feat(api): claim and take-down tokens`.

### Task 7: Public claim and take-down endpoints + emails

**Files:**
- Create: `apps/api/src/modules/claims/claims.controller.ts`, `claims.service.ts`, `claims.service.spec.ts`
- Create: `apps/api/src/modules/email/templates/claim-invite.ts`, `claim-added.ts`
- Modify: `apps/api/src/app.module.ts` (import `ClaimsModule`)

**Interfaces:**
- Produces (throttled like other public auth endpoints):
  - `GET /v1/claims/:token` → `{ organization: { name, slug, kind }, email, events: { title, startsAt }[], hasAccount: boolean }` or 410 `{ code }`.
  - `POST /v1/claims/:token/password` `{ name, password }` (12–128 chars) → creates user (`emailVerified: true`) + credential account through Better Auth `ctx.internalAdapter` and `ctx.password.hash`, OWNER membership, `claimStatus=CLAIMED`, `claimedAt`, consumes CLAIM, revokes TAKEDOWN, audits `host.claim`; returns `{ email }` so the web signs in with `signIn.email`. Existing account for that email → 409 `{ code: 'SIGN_IN' }`.
  - `POST /v1/claims/:token/attach` (signed in) → same effects for the current user; session email ≠ token email (case-insensitive) → 403 `{ code: 'EMAIL_MISMATCH' }`.
  - `GET /v1/takedown/:token` → `{ organization: { name } }` or 410; `POST /v1/takedown/:token` `{ reason?: string ≤ 1000 }` → every PUBLISHED event goes through `EventsService.cancel(eventId, null, 'Removed at the church\'s request')`, `claimStatus=DISPUTED`, audit `host.disputed` with reason, consumes TAKEDOWN.
  - `ClaimsService.sendInvite(orgId, actorUserId)` used by Task 8: issues CLAIM (and TAKEDOWN if none), sends `claim-invite` (`required: true`) with both links (`${WEB_URL}/claim/<t>`, `${WEB_URL}/takedown/<t>`); when the contact email already has an account it sends `claim-added` wording ("sign in to manage it") but still uses the claim link.
- Consumes: Task 6 service; `EventsService.cancel` (make `actorUserId` accept `null` if it doesn't).
- [ ] **Step 1: Failing tests:** `password claim for existing email returns 409 SIGN_IN`; `attach rejects mismatched email`; `takedown after claim is 410`; successful password claim → membership role `OWNER`, org `verificationStatus` still `UNVERIFIED`, takedown token revoked; takedown cancels only that org's published events.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS + `typecheck`. **Step 5:** Commit `feat(api): public claim and take-down`.

### Task 8: Admin host and event endpoints

**Files:**
- Create: `apps/api/src/modules/admin/admin-hosts.service.ts`, `admin-hosts.service.spec.ts`, `admin-events.service.ts`
- Modify: `apps/api/src/modules/admin/admin.module.ts` (new handlers; per-handler `@RequirePlatformRole`), `packages/shared/src/schemas/` (new `admin.ts`: `AdminCreateHostSchema`, `AdminContactSchema`)

**Interfaces:**
- Produces (all under `/v1/admin`):
  - `GET hosts?q=&status=unclaimed|claimed|disputed|all&kind=` (SUPPORT) → `{ items: { id, name, slug, kind, city, claimStatus, verificationStatus, contactEmail, upcomingCount, createdAt }[] }`.
  - `GET hosts/:id` (SUPPORT) → host + `events` + `lastInviteAt`.
  - `GET hosts/match?name=&email=` (MODERATOR) → `{ items: { id, name, slug, claimStatus }[] }` (case-insensitive contact-email equality OR name `ILIKE %name%`).
  - `POST hosts` (MODERATOR) body `{ church: { name, kind, city, country, contactName, contactEmail }, event: CreateEventInput }` → creates org (`claimStatus UNCLAIMED`, `verificationStatus UNVERIFIED`, currency from country as normal sign-up does, `addedByUserId`, no memberships), then `EventsService.create` + `publish`, then `ClaimsService.sendInvite`. If event create/publish throws, soft-delete the org (`deletedAt`) and rethrow. Audits `admin.host.create`, `admin.event.create`.
  - `POST hosts/:id/events` (MODERATOR) body `CreateEventInput` → only for UNCLAIMED; create + publish; audit.
  - `POST hosts/:id/resend` (MODERATOR), `PATCH hosts/:id/contact` `{ contactName?, contactEmail }` (MODERATOR; UNCLAIMED only; then resend), `POST hosts/:id/restore` (MODERATOR; DISPUTED → UNCLAIMED, re-publish nothing automatically, new invite only if staff ticks "send a new invite").
  - `GET events?status=all|live|ended|unpublished&q=` (SUPPORT); `POST events/:id/unpublish` `{ reason }` (MODERATOR) → `EventsService.cancel`.
  - Free-only: any ticket type with `priceMinor > 0` on an UNCLAIMED org → 400 `{ code: 'FREE_ONLY' }`.
- [ ] **Step 1: Failing tests:** `duplicate contact email returns matches`; `POST hosts with paid ticket returns FREE_ONLY`; `event create failure soft-deletes the new org`; created org is `UNCLAIMED` + `UNVERIFIED` with zero memberships; support role gets 403 on `POST hosts`.
- [ ] **Step 2:** FAIL. **Step 3:** Implement. **Step 4:** PASS. **Step 5:** Commit `feat(api): admin hosts and events`.

### Task 9: Hosts screens (web)

**Files:**
- Create: `apps/web/src/app/admin/(console)/hosts/page.tsx`, `hosts-table.tsx`, `hosts/[hostId]/page.tsx`

- [ ] **Step 1:** Build to Admin-Hosts and Admin-HostDetail (Overview + Events tabs only). Status chips: All / Unclaimed / Claimed / Taken down (URL `?status=`), search `?q=`. Side panel ≥1180px; phone card list linking to the profile. Unclaimed profile: "Resend claim email", "Change contact email" (dialog), "Add event". Taken down: banner + "Restore" (ConfirmDialog, optional "send a new invite").
- [ ] **Step 2:** Preview check with seeded data at 375/1280, both themes; resend shows a success toast and the audit row exists (psql).
- [ ] **Step 3:** Commit `feat(web): admin hosts`.

### Task 10: Events screen (web)

**Files:**
- Create: `apps/web/src/app/admin/(console)/events/page.tsx`, `events-table.tsx`

- [ ] **Step 1:** Build to Admin-Events with tabs All / Live / Ended / Unpublished only, no bulk bar or star this slice. Row action "Unpublish" → ConfirmDialog naming the event and "People booked will be emailed".
- [ ] **Step 2:** Preview check as Task 9. **Step 3:** Commit `feat(web): admin events`.

### Task 11: Add event for a church (web)

**Files:**
- Create: `apps/web/src/app/admin/(console)/events/new/page.tsx`, `add-for-church.tsx`
- Modify: `apps/web/src/components/host/event-form.tsx` only if needed to accept `freeOnly` (hides paid ticket kind) and an `onSubmit(input)` override instead of posting to the organiser route.

- [ ] **Step 1:** Two `StepTabs`: **Church** (pick unclaimed via search, or new: name, type, city, country chips, contact name, contact email; debounced `hosts/match` shows "Possible match" cards linking to that host) and **Event** (`EventForm` with `freeOnly`). `?hostId=` preselects and skips step 1. Submit → `POST hosts` or `POST hosts/:id/events`; success screen: "Live now · claim email sent to <email>" with links to the public page and the host profile.
- [ ] **Step 2:** Preview end-to-end locally: create church + event → public `/[org]/[event]` live; Resend logs the email (no API key locally) with both links. Phone width check.
- [ ] **Step 3:** Commit `feat(web): add event for a church`.

### Task 12: Claim and take-down pages, "Added by Ekklesia" note (web)

**Files:**
- Create: `apps/web/src/app/(auth)/claim/[token]/page.tsx`, `claim-flow.tsx`; `apps/web/src/app/(public)/takedown/[token]/page.tsx`, `takedown-form.tsx`; `apps/web/src/components/unclaimed-note.tsx`
- Modify: `apps/web/src/app/(public)/[orgSlug]/page.tsx`, `[orgSlug]/[eventSlug]/page.tsx` (render note when `claimStatus === 'UNCLAIMED'`); API public org/event selects add `claimStatus`; `lib/types.ts`.

- [ ] **Step 1:** Claim page (auth-card style, like sign-in): church name + its upcoming events; `hasAccount=false` → name + password form → `POST …/password` → `signIn.email` → `/organizer/<orgId>`; "Continue with Google" → social sign-in with `callbackURL=/claim/<token>?attach=1`, which calls `…/attach`. `hasAccount=true` → "Sign in to claim" (`/sign-in?next=/claim/<token>?attach=1`). 410 states: used/replaced, expired (with "Email me a new link" → staff-free `POST /v1/claims/:token/renew` that re-sends to the same address only — add to Task 7's controller if building here), already claimed. EMAIL_MISMATCH → "Sign in with <email>".
- [ ] **Step 2:** Take-down page: church name, optional reason textarea, "Take it down" (danger button) → done state "We've taken it down and let our team know." A DISPUTED church's host page returns 404 and it drops out of discovery; its (cancelled) event pages and tickets still open by direct link, for web and the app.
- [ ] **Step 3:** Note: one line under the host/event header, "Added by Ekklesia · Is this your church? Contact us to claim it." (link `mailto:` support address from footer). TODO(confirm) final wording.
- [ ] **Step 4:** Preview: full loop — add church (Task 11) → open claim link from API log → set password → lands in host dashboard with the event and its RSVPs; second church → take-down link → events gone from Discover, host shows "Taken down" in admin. Sweep the new pages at 375/1280 in both themes.
- [ ] **Step 5:** Commit `feat(web): claim and take-down pages`.

### Task 13: Final check

- [ ] **Step 1:** `npx -y pnpm@11.3.0 -r typecheck`, `--filter @ekklesia/api test`, `--filter @ekklesia/web build` all pass.
- [ ] **Step 2:** Re-run Review Focus cases by hand in the preview.
- [ ] **Step 2b: Mobile check.** `npx -y pnpm@11.3.0 --filter @ekklesia/mobile typecheck` passes. Against the local API, replay the app's flows with curl using a bearer token: `POST /auth/sign-in/email` (expect 200 + `set-auth-token` header), `GET /v1/me`, `GET /v1/events`, an org page, a ticket, and an RSVP — responses contain every field they had on `main` (diff the JSON keys against `main`'s API). Record the result in the final report.
- [ ] **Step 3:** Production notes for the user (not run by the agent): `prisma migrate deploy` happens on the API deploy; run `grant-role -- --list-offdomain` against production, then `grant-role -- <you>@ekklesiaevents.com` and set up the code at `/admin/sign-in`; `RESEND_API_KEY` must be set for claim emails.
