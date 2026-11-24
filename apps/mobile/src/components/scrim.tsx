import { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

/** A stop on the gradient: `at` is 0–1 down the box, `opacity` is 0–1. */
export interface ScrimStop {
  at: number;
  opacity: number;
}

export interface ScrimProps {
  /** Stops in order, top to bottom. Two or more. */
  stops: ScrimStop[];
  /** The scrim colour. Defaults to the dark ground. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A vertical gradient laid over imagery so overlaid text stays legible.
 *
 * Drawn with `react-native-svg`, which is already a native dependency of both
 * shipped binaries — so this needs no store release. `expo-linear-gradient`
 * would be the more obvious tool and is in neither binary; reaching for it
 * would turn every screen that needs a scrim into a store build.
 *
 * An earlier version of this approximated the gradient with stacked bands of
 * flat colour, on the assumption that the steps would disappear over a photo.
 * They did not — the hero showed obvious horizontal stripes on device, because
 * the steepest part of the hero ramp moves 0.54 opacity across a third of the
 * height, which is far too much to hide in sixteen-pixel jumps. SVG
 * interpolates properly and the stripes are gone.
 */
export function Scrim({ stops, color = '#0D0A0B', style }: ScrimProps) {
  const sorted = [...stops].sort((a, b) => a.at - b.at);
  // Unique per instance. Several scrims are on screen at once — the hero and
  // every card — and a shared `id` would have them all resolve to whichever
  // gradient won, if defs turn out not to be scoped per <Svg> root. Too subtle
  // a failure to risk for the cost of a hook.
  const gradientId = `scrim-${useId().replace(/:/g, '')}`;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          {/* Vertical: same x, y from top to bottom of the box. */}
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            {sorted.map((s, i) => (
              <Stop
                key={i}
                offset={`${Math.min(Math.max(s.at, 0), 1) * 100}%`}
                stopColor={color}
                stopOpacity={s.opacity}
              />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

/**
 * The two scrims the refresh uses, taken from the handoff's CSS so they are
 * not re-guessed per screen.
 */
export const scrimPreset = {
  /** Discover hero: dark at the top, clear through the middle, dark at the foot. */
  hero: [
    { at: 0, opacity: 0.72 },
    { at: 0.34, opacity: 0.18 },
    { at: 1, opacity: 0.94 },
  ] as ScrimStop[],
  /** Event card: a touch at the top for the category tag, heavy at the foot. */
  card: [
    { at: 0, opacity: 0.42 },
    { at: 0.4, opacity: 0 },
    { at: 1, opacity: 0.9 },
  ] as ScrimStop[],
};
