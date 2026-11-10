# Google Play store assets

What goes in **Play Console → Grow → Store presence → Main store listing**, and
how each file here was produced, so the next version can be regenerated rather
than redrawn from memory.

| File | Play field | Spec | Status |
|---|---|---|---|
| `icon-512.png` | App icon | 512 × 512 PNG/JPEG, ≤ 1 MB | ✅ 512 × 512, 161 KB |
| `feature-graphic.png` | Feature graphic | 1024 × 500 PNG/JPEG, ≤ 15 MB | ✅ 1024 × 500, 435 KB |
| `screenshots/*.png` | Phone screenshots | 2–8, PNG/JPEG, ≤ 8 MB each, 16:9 or 9:16, each side 320–3840 px | ✅ 5 × 1080 × 1920, 88–1452 KB |
| — | Video (optional) | public/unlisted YouTube URL, ads off, not age restricted | not used |

Text for the listing — app name, short description, full description — lives in
[`../../docs/app-store-listing.md`](../../docs/app-store-listing.md) alongside
the App Store copy, so the two stores cannot drift apart unnoticed.

## App icon

Downscaled from the app's own 1024 × 1024 icon, so it cannot drift from what
ships on the device:

```bash
sips -z 512 512 apps/mobile/assets/icon.png --out store/play/icon-512.png
```

## Feature graphic

Rendered by `tools/feature-graphic/FeatureGraphic.swift` — CoreGraphics and
CoreText, no design tool and no hand-placed pixels, so a wording change is a
one-line edit and a re-run.

```bash
swiftc -O -o /tmp/featuregraphic tools/feature-graphic/FeatureGraphic.swift
/tmp/featuregraphic apps/mobile/assets/icon.png /tmp/fg-2x.png   # 2048 x 1000
sips -z 500 1024 /tmp/fg-2x.png --out store/play/feature-graphic.png
```

It renders at 2× and downsamples so the type stays clean. The program prints the
measured width of every line and flags any that would run past the safe right
edge — the failure mode for this kind of asset is text that overflows on a
machine with different font metrics, and that should be caught by the build
rather than by looking at it.

The palette is sampled from the icon PNG itself, not eyeballed:

| Role | Value | Where it came from |
|---|---|---|
| Accent, light | `#FDB9B1` | icon pixel (300, 260) |
| Accent, deep | `#E16558` | icon pixel (760, 760) |
| Background, near | `#2E2529` | icon pixel (30, 30) |
| Background, far | `#0B0A0A` | icon pixel (990, 990) |

Note this is the one brand surface that is *not* monochrome. The product UI is
deliberately greyscale with full-colour photography, but the icon is coral on
near-black, and the feature graphic sits next to the icon in the listing — so it
follows the icon.

## Phone screenshots — not done yet

Play wants 2–8; at least **4 with a minimum of 1080 px on each side** to be
eligible for promotion, which is free to satisfy, so aim for 4–5.

They must be **Android** screenshots. The iPhone set in the App Store listing
shows an iOS status bar and iOS controls, and a listing that advertises one
platform with another platform's UI is worth a rejection.

Suggested order, same reasoning as the App Store set — the first two are what
most people actually look at:

1. The event feed, several listings with cover images
2. An event page — venue, time, host, RSVP
3. A ticket with its QR code
4. The organiser view — attendees, or the check-in scanner
5. Report and block

Capture either from a real Android device or from the `Pixel_10_Pro` emulator
(see the dev stack runbook). The Pixel_10_Pro panel is 1280 × 2856, which is
taller than 9:16; crop to 1080 × 1920 rather than padding, so the result is a
real screenshot rather than a letterboxed one.

## Phone screenshots

Five, in upload order:

| File | Screen | What it backs in the description |
|---|---|---|
| `01-discover.png` | Discover feed | "find something to go to" |
| `02-event-detail.png` | Event detail | venue, time and host "before you commit" |
| `04-ticket.png` | QR ticket | "RSVP and get a ticket with a QR code" |
| `05-organiser.png` | Your events | "running events? publish them here" |
| `03-hosts.png` | Hosts list | "see who is running it" |

Captured from a local **release** build on the Pixel_10_Pro emulator, with the
display forced to `wm size 1080x1920` — the AVD is natively 1280 × 2856, about
1:2.23, which is taller than the 9:16 Play states, so raw captures risk
rejection. The status bar is in SystemUI demo mode (9:30, full battery, full
wifi, notifications hidden) so no stray icons appear.

The content is the seeded demo data, not production. Production currently has
four events, none with a cover image, all from one host — accurate but a poor
showing. The seed set is varied and photographed and demonstrates the same
functionality. `refresh-demo-dates` has to run first or the feed is empty: the
seed dates are in the past and the feed asks for upcoming events only.

A local release build cannot reach a plain-HTTP dev server — `targetSdk 36`
blocks cleartext and the manifest sets no exemption, which only debug variants
get automatically. Capturing needs a temporary
`android/app/src/release/AndroidManifest.xml` setting
`android:usesCleartextTraffic="true"`. It is deliberately not committed; create
it, build, capture, delete.
