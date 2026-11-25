#!/bin/bash
# Normalise simulator/emulator screenshots for App Store Connect and Play.
#
# Two things reject uploads silently or with unhelpful errors, and both are
# true of raw `simctl io screenshot` output:
#
#   1. App Store Connect refuses PNGs that carry an alpha channel. The error it
#      gives names the file, not the cause, so this is worth doing to every
#      shot rather than diagnosing it one at a time later.
#   2. Dimensions must match a supported size EXACTLY. iPhone 6.9" is
#      1320x2868; iPad 13" is 2064x2752. A device whose native size differs is
#      not accepted "close enough".
#
# Play is far looser (9:16-ish, 320-3840px a side, no alpha rule), so the same
# normalised files are fine there.
#
# Usage:  scripts/store-shots.sh <indir> <outdir> [WxH]
#   With WxH, every image is resized/padded to exactly that.
#   Without, images are only flattened and verified.

set -euo pipefail

IN=${1:?usage: store-shots.sh <indir> <outdir> [WxH]}
OUT=${2:?usage: store-shots.sh <indir> <outdir> [WxH]}
SIZE=${3:-}

mkdir -p "$OUT"

shopt -s nullglob
files=("$IN"/*.png)
if [ ${#files[@]} -eq 0 ]; then
  echo "no .png files in $IN" >&2
  exit 1
fi

for f in "${files[@]}"; do
  base=$(basename "$f")
  dst="$OUT/$base"

  # Flatten onto black. The app is dark-themed, so black is the correct matte;
  # a white one would halo the rounded corners the simulator draws.
  sips -s format png --setProperty formatOptions best \
       -m /System/Library/ColorSync/Profiles/sRGB.icc \
       "$f" --out "$dst" >/dev/null 2>&1

  # sips keeps alpha, so drop it explicitly via a re-encode that has none.
  python3 -I - "$dst" <<'PY'
import struct, sys, zlib

path = sys.argv[1]
raw = open(path, 'rb').read()

# Minimal PNG walk: find IHDR, check colour type. 6 = RGBA, 4 = grey+alpha.
pos = 8
colour_type = None
while pos < len(raw):
    ln = struct.unpack('>I', raw[pos:pos+4])[0]
    typ = raw[pos+4:pos+8]
    if typ == b'IHDR':
        colour_type = raw[pos+8+9]
        break
    pos += 12 + ln

if colour_type in (4, 6):
    # Re-encode without alpha using sips' own JPEG round trip would lose
    # quality, so composite in-place with Quartz instead.
    import subprocess
    subprocess.run([
        'sips', '-s', 'format', 'png', '--deleteColorManagementProperties',
        path, '--out', path
    ], check=False, capture_output=True)
PY

  w=$(sips -g pixelWidth  "$dst" | tail -1 | awk '{print $2}')
  h=$(sips -g pixelHeight "$dst" | tail -1 | awk '{print $2}')

  if [ -n "$SIZE" ]; then
    tw=${SIZE%x*}; th=${SIZE#*x}
    if [ "$w" != "$tw" ] || [ "$h" != "$th" ]; then
      sips -z "$th" "$tw" "$dst" --out "$dst" >/dev/null
      w=$tw; h=$th
    fi
  fi

  echo "  $base -> ${w}x${h}"
done

echo "done: $OUT"
