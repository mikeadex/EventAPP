# 02 · Components

Exact markup for each is in `design/components/` or inside the page files noted. Class names refer to `design/ekklesia.css`. Translate them to Tailwind with the tokens.

## Layout

- **Container**: `max-width: 1240px; margin: auto; padding: 0 32px` (20px under 760px). Narrow pages use 1040 (tickets), 1080–1160 (booking) or 760 (onboarding, legal).
- **Section rhythm**: 112px between home sections, 96px before the footer. Section header = eyebrow (accent) + H2 + an optional outline button aligned to the right.
- **Host shell**: flex-wrap row, `gap: 40px`. Sidebar `flex: 1 1 240px; max-width: 260px`; content `flex: 999 1 560px; min-width: 0`. Under 760px the sidebar is full width and `HostNav` turns into a horizontally scrolling tab row (the identity card and "View host page" are hidden).

## Type scale (Alata 400 everywhere, no bold weights)

| Use | Size / line-height | Tracking |
|---|---|---|
| Display (home / for-churches / event hero) | 68px / 1.02 → 52 (≤900) → 42 (≤760); event hero 64 | −0.02em |
| H1 page title | 52 / 1.05 → 40 (≤760); booking and host pages use 40–44 | |
| H2 section | 40 / 1.1 → 30 (≤760) | |
| Card / panel title | 20–26 | |
| Lead | 18 / 1.6 → 16 | |
| Body | 15–17 / 1.6–1.7, colour `--body` | |
| Eyebrow | 11px uppercase, 0.2em; 10px inside cards | |
| Codes | JetBrains Mono 12–18px, 0.08–0.22em tracking | |

## Primitives

| Component | Spec |
|---|---|
| **Button** | Pill radius. Heights: `sm` 36, `md` 44, `lg` 56. Padding 16 / 20 / 28. **primary**: `bg-soft border-line-3 text-accent-ink`, hover → `border-accent` + 20% fill. **outline**: `border-line-2 text-ink`, hover → `border-line-3 text-accent`. **ghost**: text only. Disabled = `border-line text-faint` |
| **IconButton** | 40×40 circle (52 in the event hero), `border-line-2 text-ink-2`. `.glass` variant over photos |
| **Chip** (filter / segmented) | 36px pill, `border-line text-ink-2`. Selected `.on`: `border-line-3 bg-soft text-accent`. `aria-pressed` |
| **Tag** | outlined: 10px eyebrow, `border-line-3 text-accent`. solid: `bg-badge text-badge-ink` (on images). Always `width: fit-content` |
| **Field** | Search fields: 56px pill on `surface`. Form fields: 52px, radius 14, `border-line-2 bg-raised`. Focus → `border-accent`. Label above (14px), hint below in `--muted` |
| **OTP input** | 6 equal cells, 56px tall, radius 16, mono 22px. Auto-advance, backspace goes back, paste fills all, `autocomplete="one-time-code"` |
| **Switch** | 52×30 track, 22px knob. On: track `--accent`, white knob. Off: `--surface-2`, knob `--muted`. `role="switch"` |
| **Radio card** | Full-width button, radius 18, ring + dot indicator. Selected: `border-accent bg-softer`. `role="radio"` inside a `radiogroup` |
| **Stepper** | 36px circular −/+ (accent icon) with the value between. Disabled at bounds |
| **Card** | `bg-surface border-line rounded-[20px]`. Link cards lift −2px and border → `line-2` on hover |
| **Panel** (booking / summary) | radius 24, `border-line-2`, `shadow-panel`, padding 24. Sticky `top: 96px` on desktop |
| **Dividers** | `.rule-x` / `.rule-y` (they fade at the ends). Use plain `border-line` only for table and list rows |
| **Avatar (initials)** | Circle, `border-line-3 bg-avatar text-accent`. Sizes 32 / 36 / 40 / 56 / 64 / 80 / 104 |
| **Progress** | 4–6px bar, track `--line-2`, fill `--accent`. Steps = N equal bars |
| **KPI card** | Card padding 20. Eyebrow 10px, value 30px `--strong`, delta 13px (accent for good news, muted otherwise) |
| **Data table** | 11px eyebrow headers, 15px cells, padding 14–16, row borders `--line`. Wrapped in `overflow-x: auto` with min-width 560–640 |

## Composites

| Component | Props | Notes |
|---|---|---|
| **Logo / Mark** (`src/components/brand/Mark.tsx`) | size, compact | "ek" mark (stroke SVG, theme gradient via `#ek-mark`) + "ekklesia / EVENTS" wordmark. Render `<MarkDefs/>` once in the layout |
| **Header** (`Header.dc.html`) | `active`, `signedIn`, `user` | Sticky, 72px, glass background. Nav: Discover, Hosts, For churches. Right side: theme toggle, Saved, then **signed out**: Sign in (primary sm). **Signed in**: Tickets icon, "Host dashboard" (outline sm, only for host members), avatar → /account. Under 760px a burger opens a stacked menu. On the event page it overlays the hero (hero has `margin-top: -72px`) |
| **Footer** (`Footer.dc.html`) | — | Logo, blurb, store badges, three link columns, `.rule-x`, legal row. Background `--raised` |
| **EventCard** (`EventCard.dc.html`) | `event` | 16:10 cover (photo or generated art) with a solid category tag and save heart (glass). Body: eyebrow date "SAT 5 DEC AT 19:00", title (link), host, price (accent) + "N going". The heart is outside the link and toggles optimistically (signed out → sign in) |
| **EventFeatureCard** (home hero) | `event` | Photo with `.scrim-card`, title over the image, date/time/venue row with dots. Plus a floating "Next up" ticket stub (hidden under 760px) |
| **CoverArt** | `category`, `seed` (title) | For events without a photo: a radial gradient from the category palette, concentric rings and a faint mark. Deterministic per title (see `enrich()` in any page script). Uses `.cover-art`, so it inverts to blush in light |
| **HostCard** | `host` | Avatar, type eyebrow, name, 2-line bio, area · N upcoming |
| **BookingPanel** (event) | `event` | Tier rows with steppers (a single tier defaults to qty 1), "Only N left" when ≤10, optional gift chips (£0/5/10/25), `.rule-x`, places + total, CTA routed by pricing (see docs/01), footnote. Mobile: plus a fixed bottom bar (price + spots + CTA anchor to `#book`) |
| **InfoStrip** (event) | — | Location · Date · Time in a card with `.rule-y` separators; three columns at every width |
| **SummaryPanel** (booking pages) | event, lines, total, cta | Thumbnail, eyebrow date, title, host, `.rule-x`, lines, CTA, small print |
| **HostNav** (`HostNav.dc.html`) | `active` | Host identity card, "New event" primary button, links (Overview, Events, Attendees, Check-in, Payouts, Host settings), "View host page" |
| **QR ticket** (`Ticket.dc.html`) | ticket | White QR tile (200px) on the card, notched dashed divider, mono code with wide tracking, validity line. Use a real QR library |
| **Scanner** (`CheckIn.dc.html`) | eventId | 4:3 viewfinder with coral corner brackets and an animated scan line (respect reduced motion), result card colour by kind |
| **SalesChart** | series | Vertical bars, gradient `accent 50% → 12%`; the latest bar is solid accent. Tick labels below. Give it an `aria-label` summary |
| **FAQ accordion** | items | Rows with `border-line`, the question as a button with `aria-expanded`, a +/− accent sign |
