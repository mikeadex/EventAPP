# 03 · Behaviour

## Theme

- `data-theme` on `<html>`. Set it **before paint** with an inline script in the root layout (avoids a flash):

```html
<script>(function(){try{var t=localStorage.getItem('ek-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}})()</script>
```

- Order: saved choice → system preference → **dark**. The header toggle writes `localStorage['ek-theme']`. Add `suppressHydrationWarning` on `<html>`.
- `viewport.themeColor`: `#0d0a0b` (dark) / `#fffaf9` (light).
- Use `reference-implementation/app/layout.tsx` and `components/client.tsx › ThemeToggle` as working code.

## Interactions by page

**Discover.** Filters sync to the URL with `router.replace` (no scroll). Search is debounced (~250ms). Category toggles on and off; "All" clears it. When: next 7 days / next 30 days / later than 30 days. Price: free means every tier is £0. Sort: soonest (by start) or popular (by going). Show the result count in an `aria-live` line. Empty state has a "Clear all" button.

**Save (heart).** Optimistic toggle with `aria-pressed`. Signed out → `/sign-in?next=<current url>`. The Saved page reflects it.

**Event booking panel.** Quantity per tier 0..min(remaining, 10). Gift chips only when `donationsEnabled`. Total = Σ qty×price + gift (gift only if qty > 0). CTA disabled ("Choose a ticket") at 0. CTA label: "RSVP" (free) / "Choose your table" (a table tier selected) / "Continue · £X". Pass the selection into the booking draft (server-side hold). Mobile shows a fixed bottom bar with price + spots left + CTA.

**RSVP.** Places 1–10. The guest-name list grows and shrinks with places (the first is the user, prefilled). Reminder switch defaults on. Confirm → create the booking → Confirmation (`rsvp`).

**Tables.** One table per booking. Taken tables are disabled with `aria-disabled`. The selection updates the summary (table no. + position text). Show the hold countdown; on expiry, release and explain.

**Donation.** Numeric input (digits and a dot), presets set the amount, monthly switch appends "/ month", Gift Aid switch adds 25% and reveals the HMRC declaration (must be shown when on). Gift Aid only appears when the host has a charity number.

**Checkout.** Express pay (Apple Pay / Google Pay) via the existing provider; card fields through the provider's hosted fields (never raw card data in our state). Promo code: apply, then show a discount line or an inline error. Hold timer in the header ("tickets held for mm:ss"). Pay → Confirmation. A decline → Confirmation `declined` (tickets still held; "Try another method", "Use a different card", "Contact the host").

**Ticket QR.** Ticket tabs switch the QR + code. "Show me as going" is a persisted switch. QR content = the ticket code (or a signed token, per backend). Add to Apple/Google Wallet, .ics calendar, PDF and directions (Google Maps search URL) where the backend supports them.

**Auth.** OTP cells auto-advance, support paste and resend with a cooldown ("Resend in 0:42"); codes expire in 10 minutes (copy). Password rules: 12+ characters, a number, a symbol (the API enforces 12). The strength meter has 4 segments (length, number, symbol, mixed case). Every auth page honours `?next=`.

**Account.** The section nav switches the panel (keep it in `?section=`). Notification switches save immediately (optimistic, toast on error). Delete account needs a confirmation dialog.

**Host onboarding.** Step state is in the URL or a form store. Slug is derived from the name (lowercase, hyphenated) and editable, with a live availability check. Country sets currency: GB→GBP, IE→EUR, US→USD. About is limited to 240 characters with a live counter. Choosing "Free events only" hides the bank fields. Bank details go **straight to the payment provider** (the copy says Ekklesia doesn't hold them). Finish → `/host`.

**Create event.** Step tabs are clickable and Save draft is always available. The live preview card updates its title, category and price label. Pricing segmented control: Paid (tier rows: name, price, quantity, remove; "+ Add another tier"; previews from `fees.tierPreview`; pass-fees switch), Free (places, max per booking), Donation (suggested amount, places). "Repeats weekly" creates 6 dates. Review shows a summary + visibility (public = Discover + host page; unlisted = link only). Publish → `/host`.

**Dashboard.** Range chips refetch `SalesSummary`. Events table: status tag (Live = accent, Draft = muted), sold/capacity bar, sales, links to attendees and edit.

**Attendees.** Search by name or code, filter chips, and a per-row check-in toggle that is optimistic and updates the "Checked in" KPI. Export CSV and Message attendees (backend). "Open scanner" → check-in.

**Check-in.** Camera via `getUserMedia` (rear camera) + a QR decoder. Debounce repeat scans of the same code (~3s). Result card states: **valid** (accent, ✓, name, qty + tier, time), **used** (when and by which door), **wrong event**, **invalid**. Manual code entry uses the same endpoint. The progress bar shows checked-in / booked. Haptic/audio feedback is a nice-to-have. It must work on a phone at the door, so test it at 390px.

## States every data page needs

- **Loading**: skeleton cards/rows in the final layout sizes (no spinners on full pages).
- **Empty**: Discover (no match), Saved (nothing saved), Tickets (no upcoming / no past), Host events (no events, so a "Create your first event" CTA), Attendees (no bookings yet).
- **Error**: an inline card with a retry action. Form errors go under the field in accent, plus `aria-describedby`.
- **Past / cancelled event**: the booking panel is replaced by a note; cards show a muted status tag.
- **Sold out**: the tier row shows "Sold out" and its stepper is disabled; when everything is sold out the CTA reads "Sold out".

## Images

- Event covers are 16:10 on cards and full-bleed in the event hero. Always `object-fit: cover`. Use `next/image` with `sizes`.
- With no photo, use the CoverArt component (never a broken image).
- Host logos are square ≥512px; with no logo, show the initials avatar.

## SEO and metadata

- Per-page `generateMetadata`. Event pages output JSON-LD `Event` with an offer per tier (see `reference-implementation/app/events/[slug]/page.tsx`).
- `sitemap.ts` (events + hosts) and `robots.ts` (disallow /sign-in, /account, /tickets, /saved, /checkout, /host).
- OG image: event photo or a generated cover.

## Accessibility checklist

Skip link to `#main` · a single `h1` per page · labelled form controls · `aria-live` for result counts, totals and the scan result · focus visible (2px accent outline) · keyboard-operable chips, steppers, switches, table map and accordion · `prefers-reduced-motion` respected (the scan line, card hovers) · minimum 44px touch targets on mobile.
