# Ekklesia Events — web front-end handover

You are implementing the **ekklesiaevents.com** web front end inside an **existing Next.js app that already has its backend** (API, auth, payments, database). This pack is the approved design plus everything needed to build it faithfully. **Do not rebuild the backend.** Wire the UI to the existing APIs through adapters.

Approved design canvas (live, clickable, dark + light, desktop + mobile):
https://claude.ai/artifact/NadB7P84hrigXCCc9eRXqW

## What's in this pack

| Path | What it is | How to use it |
|---|---|---|
| `docs/01-pages-and-routes.md` | Every page → Next.js route, auth, data, links | **Start here.** Build order is at the bottom |
| `docs/02-components.md` | Shared components, props, variants, states | Build these first |
| `docs/03-behaviour.md` | Theme, interactions, validation, empty/loading/error states, a11y, SEO | Read before any page |
| `docs/04-open-questions.md` | Things the product owner must confirm | Leave TODOs, don't invent answers |
| `styles/tokens.css` | Colour, type and radius tokens for both themes + signature utilities (Tailwind v4) | Merge into `app/globals.css` |
| `src/types/ekklesia.ts` | UI data contracts for every page | Copy in; map backend → these with adapters |
| `src/lib/fees.ts` | Platform fee, booking fee, Gift Aid maths | For live previews only, the server decides real charges |
| `src/lib/format.ts` | en-GB / Europe/London dates, GBP | Copy in |
| `src/components/brand/Mark.tsx` | The "ek" mark + logo + shared SVG gradient | Copy in |
| `design/pages/*.dc.html`, `design/components/*.dc.html` | **Exact design source** for each page (HTML + inline styles + JS state) | The pixel spec. Read the file for any page you build |
| `design/ekklesia.css` | The stylesheet the design pages use | Layout breakpoints and class reference |
| `design/sample-data.json` | Sample events and hosts used in the design | Seed / Storybook / tests only |
| `assets/` | Event photos, brand lockups, iOS/Android icons | `public/images`, `public/brand`, favicons |
| `reference-implementation/` | An earlier Next 16 + Tailwind v4 build of the **browse pages only** | Working patterns for theme script, tokens, EventCard, booking panel. **Where it differs from `design/`, `design/` wins** |

## Reading a `.dc.html` design file

Each file is one page. Read it like this:
- The markup between `<x-dc>` … `</x-dc>` is the page. Inline `style` values are the exact spacing, sizes and colours (as `var(--token)`).
- `{{ name }}` are bindings computed in the `<script type="text/x-dc">` block at the bottom (`renderVals()`). That script **is the interaction spec**: state, derived values, handlers, sample data.
- `<sc-for list=…>` = map over a list. `<sc-if value=…>` = conditional render.
- `<dc-import name="Header" …>` = a shared component in `design/components/` (the attributes are its props, kebab-case → camelCase).
- `<a href="Event.dc.html">` = a link to another page. Map it with the route table in `docs/01`.
- `data-props` on the script tag lists design-time tweaks (e.g. `theme`, `step`, `outcome`). These are **states you must support**, not user-facing controls.
- `Mobile-*.dc.html` and `Light-*.dc.html` on the canvas are only previews of the same page at 390px / in light theme, so they aren't included. Every page must be responsive and work in both themes.

## Non-negotiables

1. **Tokens only.** Never hard-code hex values in components. Use the Tailwind colour names from `tokens.css` (`bg-surface`, `text-ink-2`, `border-line-2`, `text-accent` …) or `var(--…)`.
2. **Both themes, every page.** Dark is default. Light swaps the accent to `#C4392C` (coral `#F98E80` fails contrast on white). Verify each page in both themes.
3. **The look:** Alata for all UI text, JetBrains Mono for ticket codes, references and numeric codes. Primary actions are a **tinted fill + 1px accent border** (`bg-soft border-line-3 text-accent-ink`), never a solid flood. Dividers **fade at both ends** (`.rule-x` / `.rule-y`). Photos get a scrim (`.scrim-hero` / `.scrim-card`). Category tags: solid (`bg-badge text-badge-ink`) on images, outlined (`border-line-3 text-accent`) elsewhere. Uppercase tracked labels use `.eyebrow`.
4. **Responsive:** content max-width 1240px, side padding 32px → 20px under 760px. Breakpoints used by the design: **1180, 1024, 900, 760px** (see `design/ekklesia.css`). Mobile is a first-class layout, not a squeezed desktop.
5. **Accessibility:** real `<button>`, `<a>`, `<label>`. Icon-only buttons need `aria-label`. Switches use `role="switch" aria-checked`. Toggle chips use `aria-pressed`. Text contrast ≥ 4.5:1 (the tokens already pass).
6. **Server components by default.** Make a component a client component only when it holds state (filters, booking panel, steppers, switches, theme toggle, forms, scanner).
7. **Don't invent product facts.** Fees, policies and legal copy marked in `docs/04` stay as TODOs until confirmed.

## Suggested stack additions (if not already in the app)

`@fontsource/alata`, `@fontsource/jetbrains-mono`, `@phosphor-icons/react` (the app's icon family; the design uses equivalent stroke icons), a QR library for tickets (e.g. `qrcode`), and a camera QR reader for check-in (e.g. `@zxing/browser`). Choose versions that match the app's existing React and Next.js versions.
