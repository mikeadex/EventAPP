> **Reference only.** An earlier build of the browse pages (Home, Discover, Event, Hosts, For churches). Use it for working patterns: theme script, tokens in `app/globals.css`, EventCard, BookingPanel, JSON-LD, sitemap. Where it differs from `../design/`, the design wins. Sample data lives in `lib/data.ts`.

# Ekklesia Events — website (ekklesiaevents.com)

The public website and web app for Ekklesia Events. It uses the same visual language as the iOS and Android app: coral on near-black, Alata type, outlined actions, fading rules and photo scrims. It is built for desktop first and works down to mobile.

## Stack

- Next.js 16 (App Router, React 19, TypeScript). Every page is static or SSG today.
- Tailwind CSS v4. Tokens live in `app/globals.css`.
- `@phosphor-icons/react`, the same icon family as the app. Server components import from `@phosphor-icons/react/ssr`; client components import from `@phosphor-icons/react`.
- Fonts are self-hosted through `@fontsource/alata` and `@fontsource/jetbrains-mono`, so the build makes no Google Fonts request.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Theme

- The theme is set with `data-theme="dark|light"` on `<html>`. An inline script in `app/layout.tsx` sets it before paint. It uses the saved choice (`localStorage['ek-theme']`) first, then the system preference, then dark. The header toggle switches it.
- Every colour is a CSS variable. **Don't hard-code hex values in components.** Use the Tailwind names instead: `bg-bg`, `bg-surface`, `bg-raised`, `text-strong`, `text-ink`, `text-ink-2`, `text-body`, `text-muted`, `text-faint`, `text-accent`, `bg-accent-soft`, `border-line`, `border-line-2` and `border-line-3`.
- The accent is `#F98E80` on dark and `#C4392C` on light, because `#F98E80` fails contrast on white. All text tokens pass WCAG AA on their grounds.
- The primary action is a tinted fill with a 1px accent border (`buttonClass("primary")`), never a flat flood.
- The design language helpers live in `globals.css`: `.rule-x` and `.rule-y` (fading dividers), `.scrim-hero`, `.scrim-card` and `.eyebrow`.
- The "ek" mark (`components/brand.tsx`) uses one shared SVG gradient, `#ek-mark`, whose stops follow the theme.

## Structure

```
app/
  page.tsx                 Home / landing
  events/page.tsx          Discover (filters in the URL: ?q, category, when, price, sort)
  events/[slug]/           Event detail + booking panel + mobile booking bar
  hosts/, hosts/[slug]/    Host directory + host profile
  for-hosts/               Landing for churches / ministries
  saved/                   Saved events (localStorage for now)
  sign-in/                 Email code + Apple/Google UI (not wired)
  privacy/, terms/         Placeholders — paste the published policies
components/                Header, footer, cards, cover art, phone mockup, UI primitives
lib/data.ts                SAMPLE events + hosts — replace with the real API
lib/format.ts              en-GB / Europe/London date + GBP helpers
```

## Wiring to the real backend (next steps)

1. Replace `lib/data.ts` with fetches to the app's API. Keep the `EventItem`, `Host` and `TicketTier` shapes, or map onto them. Switch the event and host pages to ISR or on-demand revalidation.
2. Connect auth on `/sign-in` to the same provider the app uses: email OTP, Apple and Google.
3. Point the booking panel's CTA at real checkout. The app does not take payments yet, so free RSVP is the first flow to connect.
4. Saved events and follows currently stay in the browser. Sync them to the user's account once auth is in place.
5. Set `APP_STORE_URL` and `PLAY_STORE_URL` in `components/store-badges.tsx` once the listings are live.
6. Event images: `public/images` holds two photos taken from app screenshots. Events without a photo get generated, on-brand cover art from `components/cover.tsx`. Use the host's own images in production.

## Design source

The mobile design files (33 app screens in dark and light, the brand sheet and email templates) are in the separate `ekklesia-design-export` pack. Match new web screens to the app screen of the same name.
