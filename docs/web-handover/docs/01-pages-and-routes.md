# 01 · Pages and routes

Rename routes to match the existing app if it already has conventions. **Auth:** public = anyone, user = signed in (redirect to `/sign-in?next=…`), host = signed in and a member of the host.

## Browse (public)

| Design file | Route | Auth | Data (see `src/types`) | Notes |
|---|---|---|---|---|
| `Main.dc.html` | `/` | public | 6 soonest `EventItem`, category counts, 3 featured `Host` | Hero with search (submits to `/events?q=`), "Happening soon", categories, how it works, hosts, "For churches" band, app download band, FAQ accordion |
| `Discover.dc.html` | `/events` | public | `EventItem[]` from `DiscoverQuery` | Filters **live in the URL** (`?q&category&when&price&sort`), shareable and back-button safe. Filter sidebar 260px, which stacks above results under 900px. Shows an empty state |
| `Event.dc.html` | `/events/[slug]` | public | `EventItem`, more from host (≤3) | Full-bleed hero under a transparent header. Location/Date/Time strip, about, when & where + map link, hosted by, a **sticky booking panel**, and a **fixed bottom booking bar on mobile**. Outputs JSON-LD `Event` |
| `Hosts.dc.html` | `/hosts` | public | `Host[]` | Type filter chips (All, Churches, Ministries, Communities), grouped by type |
| `Host.dc.html` | `/hosts/[slug]` | public | `Host`, the host's upcoming `EventItem[]` | Follow button (signed out → sign in) |
| `ForChurches.dc.html` | `/for-churches` | public | static | Host marketing page: types, 8 features, 3 steps, FAQ, CTA → `/host/onboarding` |

## Account & tickets

| Design file | Route | Auth | Data | Notes |
|---|---|---|---|---|
| `SignIn.dc.html` | `/sign-in` | public | — | Steps: `start` (Apple / Google / email) → `password` or `code` (6-digit email OTP) → `done`. Respect `?next=` |
| `CreateAccount.dc.html` | `/sign-up` | public | — | Steps: `form` (with live password meter) → `verify` (email OTP) → `done` (Browse events, or set up a host profile) |
| `ResetPassword.dc.html` | `/reset-password` | public | — | Steps: `request` → `sent` → `new` (rules tick live: 12+ characters, a number, a symbol) → `done`. The emailed link lands on step `new` with a token |
| `Tickets.dc.html` | `/tickets` | user | `Booking[]` | Upcoming / Past tabs. A row per booking, with the ticket code and a CTA to the QR |
| `Ticket.dc.html` | `/tickets/[bookingId]` | user | `Booking` | QR ticket. Switch between the booking's tickets ("Ticket 1 of 2"), **Show me as going** switch, wallet/calendar/PDF/directions actions, transfer/cancel |
| `Saved.dc.html` | `/saved` | user | `EventItem[]` (saved) | Grid of EventCards, with an empty state (`empty` tweak) |
| `Account.dc.html` | `/account?section=profile\|notify\|hosting\|security` | user | `User` | Settings with a section nav. Sign out |

## Booking & checkout

| Design file | Route | Auth | Data | Notes |
|---|---|---|---|---|
| (Event booking panel) | — | public | — | CTA routing: **free → RSVP**, **paid with a table tier selected → Tables**, **paid → Checkout**. Booking needs sign-in: redirect with `next` back to the same step |
| `Rsvp.dc.html` | `/events/[slug]/rsvp` | user | `EventItem` | Places stepper (1–10, capped by remaining), one guest-name field per place, 24h reminder switch, sticky summary |
| `Tables.dc.html` | `/events/[slug]/tables` | user | table map + availability | Seat map (stage plus a 4-column grid). States: available, yours, taken (disabled). Hold timer. Continue → checkout |
| `Donation.dc.html` | `/events/[slug]/give` | user | `EventItem` | Amount input + presets (£10/20/25/50), monthly switch, Gift Aid switch (+25%, with the declaration shown when on), summary |
| `Checkout.dc.html` | `/checkout/[draftId]` | user | `BookingDraft`, `PriceBreakdown` | Details, Apple Pay / Google Pay / card, promo code, summary, hold timer. Uses the existing payment integration |
| `Confirmation.dc.html` | `/bookings/[id]/confirmation` | user | `Booking`, `PaymentOutcome` | Three states: `paid`, `rsvp`, `declined` (tickets still held, with retry). The declined state can stay on the checkout route if that fits your payment flow better |

## Host dashboard (shared `HostNav` sidebar; on phones it becomes a horizontal tab row)

| Design file | Route | Auth | Data | Notes |
|---|---|---|---|---|
| `BecomeHost.dc.html` | `/host/onboarding` | user | `HostOnboarding` | 3 steps with a progress bar: organisation (type, name, slug, country → currency) → page (logo, cover, about ≤240 with counter, city) → getting paid (bank / free-only, bank fields, charity number, fee note) |
| `Dashboard.dc.html` | `/host` (or `/host/[hostSlug]`) | host | `SalesSummary` | Range chips 30d/90d/Year, 4 KPIs, sales bar chart, events table (status, sold/capacity bar, sales, links), next payout card |
| `CreateEvent.dc.html` | `/host/events/new`, `/host/events/[id]/edit` | host | `EventDraft` | Steps: basics → tickets → review & publish. **Live preview card**. Tickets: Paid / Free / Donation. Paid tiers can be added and removed, each showing "Attendee pays / You receive" from `fees.ts`. Pass-fees switch. Visibility: public/unlisted. Save draft at any step |
| `Attendees.dc.html` | `/host/events/[id]/attendees` | host | `Attendee[]` | KPIs (booked / checked in / spots left), search name or code, filter (All / Checked in / Not yet), per-row check-in toggle, Export CSV, Message attendees, Open scanner |
| `CheckIn.dc.html` | `/host/events/[id]/check-in` | host | `ScanResult` | Camera viewfinder (live QR scan), result card (valid / already used / wrong event / invalid), manual code entry, recent scans, progress bar. **Works well on a phone at the door** |
| `Payouts.dc.html` | `/host/payouts` | host | `PayoutSummary` | Next payout, period breakdown, history table, bank account, statement download |

## Also needed (not drawn, use the same patterns)

`/privacy`, `/terms` (long-form text pages: eyebrow + h1 + `.rule-x` + prose at max-width 760px), and a `not-found` page (mark, title, Discover + Home buttons). The reference implementation has all three.

## Build order

1. Tokens, fonts, theme script, `Mark`, `Header`, `Footer`, buttons/chips/tags/fields (docs/02)
2. `EventCard`, then Home, Discover, Event (the reference implementation covers most of this)
3. Auth (sign in, sign up, reset), which unlocks the signed-in header
4. Booking: RSVP, Tables, Donation, Checkout, Confirmation, then Tickets, Ticket QR, Saved, Account
5. Host: onboarding, then `HostNav` + Dashboard, Create event, Attendees, Check-in, Payouts
6. Hosts directory, host profile, For churches
7. Check each page in both themes at 1440, 1024, 768 and 390px
