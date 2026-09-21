// Renders the Play Store feature graphic at 2048x1000 (2x of the required
// 1024x500) so text downsamples cleanly. Colours are sampled from the real app
// icon rather than guessed: see store/play/README.md.
//
// Build:  swiftc -O -o /tmp/featuregraphic tools/feature-graphic/FeatureGraphic.swift
// Run:    /tmp/featuregraphic apps/mobile/assets/icon.png /tmp/fg-2x.png

import AppKit
import CoreText
import Foundation

let S: CGFloat = 2          // render scale over the 1024x500 deliverable
let W: CGFloat = 1024 * S
let H: CGFloat = 500 * S

func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(red: CGFloat((hex >> 16) & 0xff) / 255,
            green: CGFloat((hex >> 8) & 0xff) / 255,
            blue: CGFloat(hex & 0xff) / 255,
            alpha: a)
}

let args = CommandLine.arguments
guard args.count == 3 else { fputs("usage: featuregraphic <icon.png> <out.png>\n", stderr); exit(2) }
let iconURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

let space = CGColorSpaceCreateDeviceRGB()
guard let ctx = CGContext(data: nil, width: Int(W), height: Int(H), bitsPerComponent: 8,
                          bytesPerRow: 0, space: space,
                          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else {
    fputs("could not create bitmap context\n", stderr); exit(1)
}
ctx.setAllowsAntialiasing(true)
ctx.interpolationQuality = .high

// CoreGraphics is bottom-up; the layout below is written top-down, as the
// design is, and converted here.
func fromTop(_ y: CGFloat) -> CGFloat { H - y * S }
func sc(_ v: CGFloat) -> CGFloat { v * S }

// ---------------------------------------------------------------- background

ctx.saveGState()
let bg = CGGradient(colorsSpace: space,
                    colors: [rgb(0x2E2529), rgb(0x171315), rgb(0x0B0A0A)] as CFArray,
                    locations: [0, 0.55, 1])!
ctx.drawLinearGradient(bg, start: CGPoint(x: 0, y: H), end: CGPoint(x: W, y: 0), options: [])
ctx.restoreGState()

// A coral bloom behind the wordmark, lifted straight off the icon's own accent.
ctx.saveGState()
let glow = CGGradient(colorsSpace: space,
                      colors: [rgb(0xE16558, 0.30), rgb(0xE16558, 0)] as CFArray,
                      locations: [0, 1])!
ctx.drawRadialGradient(glow,
                       startCenter: CGPoint(x: W * 0.74, y: H * 0.78), startRadius: 0,
                       endCenter: CGPoint(x: W * 0.74, y: H * 0.78), endRadius: W * 0.52,
                       options: [])
ctx.restoreGState()

// ---------------------------------------------------------------------- icon

let iconRect = CGRect(x: sc(84), y: fromTop(334), width: sc(168), height: sc(168))
let iconPath = CGPath(roundedRect: iconRect, cornerWidth: sc(38), cornerHeight: sc(38),
                      transform: nil)

if let src = CGImageSourceCreateWithURL(iconURL as CFURL, nil),
   let img = CGImageSourceCreateImageAtIndex(src, 0, nil) {
    ctx.saveGState()
    ctx.addPath(iconPath)
    ctx.clip()
    ctx.draw(img, in: iconRect)
    ctx.restoreGState()
} else {
    fputs("could not read icon \(args[1])\n", stderr); exit(1)
}

ctx.saveGState()
ctx.addPath(iconPath)
ctx.setStrokeColor(rgb(0xFFFFFF, 0.10))
ctx.setLineWidth(sc(1.5))
ctx.strokePath()
ctx.restoreGState()

// ---------------------------------------------------------------------- text

let textX = sc(296)
/// Play can crop the graphic; keep everything clear of the right-hand edge.
let safeRight = W - sc(40)

func draw(_ s: String, size: CGFloat, weight: NSFont.Weight, colour: CGColor,
          baselineFromTop y: CGFloat, tracking: CGFloat = 0, label: String) {
    let font = NSFont.systemFont(ofSize: size * S, weight: weight)
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font,
        .foregroundColor: NSColor(cgColor: colour)!,
        .kern: tracking * S,
    ]
    let line = CTLineCreateWithAttributedString(
        NSAttributedString(string: s, attributes: attrs))
    let width = CTLineGetTypographicBounds(line, nil, nil, nil)
    ctx.textPosition = CGPoint(x: textX, y: fromTop(y))
    CTLineDraw(line, ctx)
    let right = textX + CGFloat(width)
    let flag = right > safeRight ? "  OVERFLOWS" : ""
    fputs(String(format: "  %-10s %6.0f px wide, right edge %6.0f (safe %.0f)%@\n",
                 (label as NSString).utf8String!, width, right, safeRight, flag), stderr)
}

fputs("text metrics at \(Int(W))x\(Int(H)):\n", stderr)
draw("Ekklesia Events", size: 62, weight: .semibold, colour: rgb(0xFFFFFF),
     baselineFromTop: 216, tracking: -1.5, label: "title")
draw("Church & community events near you", size: 29, weight: .regular,
     colour: rgb(0xBDB5B3), baselineFromTop: 264, tracking: -0.2, label: "subtitle")

ctx.saveGState()
ctx.setFillColor(rgb(0xE16558))
ctx.fill(CGRect(x: sc(297), y: fromTop(296), width: sc(48), height: sc(2.5)))
ctx.restoreGState()

draw("Free to browse. Free to attend.", size: 25, weight: .medium,
     colour: rgb(0xFDB9B1), baselineFromTop: 343, tracking: -0.2, label: "tagline")

// --------------------------------------------------------------------- write

guard let out = ctx.makeImage(),
      let dest = CGImageDestinationCreateWithURL(outURL as CFURL, "public.png" as CFString, 1, nil)
else { fputs("could not encode PNG\n", stderr); exit(1) }
CGImageDestinationAddImage(dest, out, nil)
guard CGImageDestinationFinalize(dest) else { fputs("could not write PNG\n", stderr); exit(1) }
print("wrote \(outURL.path) at \(out.width)x\(out.height)")
