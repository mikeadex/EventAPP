import { useId } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';
import type { StyleProp, ViewStyle } from 'react-native';

/**
 * The `ek` monogram.
 *
 * Five stroked paths — a bar and an arc for the `e`, three strokes for the
 * subscript `k` — over the coral ramp. Taken from the handoff's logo sheet
 * rather than redrawn, and kept as geometry rather than exported to PNG so it
 * stays sharp at every size and ships over the air (`react-native-svg` is in
 * both binaries; see gradient.tsx for why that matters).
 *
 * The artwork is authored in a 100x100 box but only occupies part of it, so
 * the viewBox is the tight crop — otherwise every caller pays for invisible
 * padding and the mark reads smaller than the size it was given.
 */

/** The drawn extent of the mark inside its 100x100 authoring box. */
const VIEW_BOX = '11.5 16.6 85 78';
const ASPECT = 78 / 85;

/**
 * Stroke weights are optically sized, not scaled.
 *
 * The handoff draws the same mark at 96px with a 6.2 `k` and at 28px with an
 * 8 — because a stroke that is correct at poster size disappears at the size
 * this sits in a navigation bar. Scaling one set of weights for everything
 * gives you either a clotted large mark or a broken small one, so the three
 * bands below are the handoff's own measurements rather than an interpolation
 * of them.
 */
function weights(size: number): { e: number; k: number } {
  if (size >= 48) return { e: 13, k: 6.3 };
  if (size >= 32) return { e: 13.5, k: 7 };
  return { e: 14, k: 8 };
}

export interface LogoProps {
  /** Rendered width in points; height follows the mark's aspect. */
  size?: number;
  /**
   * Draw in a single flat colour instead of the coral ramp. For places the
   * gradient would fight what is behind it — over a photo, or inside a filled
   * accent control.
   */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function Logo({ size = 32, color, style }: LogoProps) {
  // Gradient ids are document-global in SVG. Two marks on one screen with the
  // same id means the second silently adopts the first's gradient, which is
  // fine until one of them is a different colour.
  const id = `ek-${useId()}`;
  const { e, k } = weights(size);
  const stroke = color ?? `url(#${id})`;

  return (
    <Svg
      width={size}
      height={size * ASPECT}
      viewBox={VIEW_BOX}
      fill="none"
      style={style}
      // The mark carries the product name, so it is content rather than
      // decoration: a screen whose only heading is the logo would otherwise
      // announce nothing at all.
      accessibilityRole="image"
      accessibilityLabel="Ekklesia"
    >
      {color ? null : (
        <Defs>
          <LinearGradient id={id} x1="18" y1="24" x2="92" y2="90" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FFC9C2" />
            <Stop offset="0.55" stopColor="#F98E80" />
            <Stop offset="1" stopColor="#D9564A" />
          </LinearGradient>
        </Defs>
      )}
      <G stroke={stroke} strokeLinecap="round" fill="none">
        <Path d="M18 50 H70" strokeWidth={e} />
        <Path d="M70 50 A26 26 0 1 0 58 71" strokeWidth={e} />
        <Path d="M76 62 V88" strokeWidth={k} />
        <Path d="M76 79 L88 68" strokeWidth={k} />
        <Path d="M76 79 L90 88" strokeWidth={k} />
      </G>
    </Svg>
  );
}
