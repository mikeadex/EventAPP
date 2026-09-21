# Google Play store assets

What goes in **Play Console → Grow → Store presence → Main store listing**, and
how each file here was produced, so the next version can be regenerated rather
than redrawn from memory.

| File | Play field | Spec | Status |
|---|---|---|---|
| `icon-512.png` | App icon | 512 × 512 PNG/JPEG, ≤ 1 MB | ✅ 512 × 512, 161 KB |
| `feature-graphic.png` | Feature graphic | 1024 × 500 PNG/JPEG, ≤ 15 MB | ✅ 1024 × 500, 435 KB |
| — | Phone screenshots | 2–8, PNG/JPEG, ≤ 8 MB each, 16:9 or 9:16, each side 320–3840 px | ❌ still to capture |
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
