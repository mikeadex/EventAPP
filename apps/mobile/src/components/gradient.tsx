import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/**
 * Linear gradients, drawn with `react-native-svg`.
 *
 * `react-native-svg` 15.8.0 is already a native dependency of both shipped
 * binaries, so everything here ships over the air. `expo-linear-gradient`
 * would be the more obvious tool and is in NEITHER binary; reaching for it
 * would turn every screen that needs a gradient into a store release.
 *
 * An earlier version of the scrim approximated its gradient with stacked
 * bands of flat colour, on the assumption the steps would disappear over a
 * photo. They did not — the hero showed obvious horizontal stripes on device,
 * because the steepest part of that ramp moves 0.54 opacity across a third of
 * the height, far too much to hide in sixteen-pixel jumps. SVG interpolates
 * properly.
 */

/** A stop: `at` is 0–1 along the gradient, `opacity` is 0–1. */
export interface GradientStop {
  at: number;
  opacity: number;
  /** Per-stop colour. Defaults to the component's `color`. */
  color?: string;
}

export interface GradientProps {
  stops: GradientStop[];
  /** Base colour for stops that do not name their own. */
  color?: string;
  /**
   * CSS `linear-gradient` angle in degrees: 0 points to the top, 90 to the
   * right, 180 to the bottom. Matches the handoff's own values so they can be
   * copied across without re-deriving them. Defaults to 180 (top to bottom).
   */
  angle?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * CSS angle → SVG unit-square endpoints.
 *
 * A CSS angle names where the gradient points TO, measured clockwise from
 * "to top": 0 = up, 90 = right, 180 = down. On screen y grows downward, so
 * that direction is (sin θ, −cos θ) — and SVG's y grows downward too, so the
 * same vector works unchanged. The gradient line is centred on the box, so
 * each endpoint sits half the vector either side of (0.5, 0.5).
 *
 *   180 → (0.5,0) to (0.5,1)      top to bottom
 *    90 → (0,0.5) to (1,0.5)      left to right
 *   150 → (0.25,0.07) to (0.75,0.93)   the monogram-tile diagonal
 */
function endpoints(angle: number) {
  const r = ((angle % 360) * Math.PI) / 180;
  const dx = Math.sin(r) / 2;
  const dy = -Math.cos(r) / 2;
  return {
    x1: String(0.5 - dx),
    y1: String(0.5 - dy),
    x2: String(0.5 + dx),
    y2: String(0.5 + dy),
  };
}

export function Gradient({ stops, color = '#0D0A0B', angle = 180, style }: GradientProps) {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  // Unique per instance. Several gradients are on screen at once — the hero
  // and every card — and a shared `id` would have them all resolve to
  // whichever won, if defs turn out not to be scoped per <Svg> root. Too
  // subtle a failure to risk for the cost of a hook.
  const id = `grad-${useId().replace(/:/g, '')}`;
  const { x1, y1, x2, y2 } = endpoints(angle);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
            {sorted.map((s, i) => (
              <Stop
                key={i}
                offset={`${Math.min(Math.max(s.at, 0), 1) * 100}%`}
                stopColor={s.color ?? color}
                stopOpacity={s.opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/** A vertical scrim over imagery, so overlaid text stays legible. */
export function Scrim({
  stops,
  color = '#0D0A0B',
  style,
}: {
  stops: GradientStop[];
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return <Gradient stops={stops} color={color} angle={180} style={style} />;
}

/**
 * The scrims the refresh uses, taken from the handoff's CSS so they are not
 * re-guessed per screen.
 */
export const scrimPreset = {
  /** Discover hero: dark at the top, clear through the middle, dark at the foot. */
  hero: [
    { at: 0, opacity: 0.72 },
    { at: 0.34, opacity: 0.18 },
    { at: 1, opacity: 0.94 },
  ] as GradientStop[],
  /** Event card: a touch at the top for the category tag, heavy at the foot. */
  card: [
    { at: 0, opacity: 0.42 },
    { at: 0.4, opacity: 0 },
    { at: 1, opacity: 0.9 },
  ] as GradientStop[],
  /** Ticket card cover: clear until 40%, then into the card's own surface. */
  ticketCover: [
    { at: 0.4, opacity: 0, color: '#1B1517' },
    { at: 1, opacity: 0.9, color: '#1B1517' },
  ] as GradientStop[],
};

/**
 * A hairline rule that fades out at both ends rather than stopping flat.
 *
 * The handoff draws these as a horizontal gradient with the colour held
 * between roughly 10% and 90% — used between ticket-card meta and its code,
 * and between the rows of the profile menu.
 */
export function Divider({
  inset = 0.1,
  opacity = 0.22,
  style,
}: {
  /** Where the colour reaches full strength, as a fraction of the width. */
  inset?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ height: 1 }, style]}>
      <Gradient
        angle={90}
        color="#F98E80"
        stops={[
          { at: 0, opacity: 0 },
          { at: inset, opacity },
          { at: 1 - inset, opacity },
          { at: 1, opacity: 0 },
        ]}
      />
    </View>
  );
}
