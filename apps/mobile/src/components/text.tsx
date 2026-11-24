import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { fontFamily, palette, theme, type ThemeName } from '@ekklesia/ui/tokens';

/**
 * The refresh's text primitive.
 *
 * Every screen in the handoff declares Alata once at the screen root and lets
 * it inherit. React Native has no such inheritance — `fontFamily` must be set
 * on each `<Text>` — so without a primitive every style block has to remember
 * it. Discover was restyled by hand first and proved the point: ten of its
 * styles carry `fontFamily` and nine do not, so half the screen silently
 * rendered in the system face. Thirty-two screens of that is not a thing to
 * catch by eye.
 *
 * Alata ships ONE weight. `fontWeight` is therefore not part of this API and
 * is stripped from anything passed through `style`: asking for bold gives
 * synthetic smearing on iOS and a silent fall back to a different family on
 * Android. Hierarchy here is carried by size, tone and tracking — which is how
 * the handoff draws it.
 *
 * Sizes and line-height ratios are measured from the handoff screens rather
 * than invented: 11/12/13/14/15/16 carry ~2400 of its ~2800 type declarations,
 * with 18/20/22/30/34 above them.
 */

export type TextVariant =
  | 'hero'
  | 'display'
  | 'title'
  | 'heading'
  | 'subtitle'
  | 'bodyLg'
  | 'body'
  | 'footnote'
  | 'label'
  | 'caption'
  | 'overline'
  | 'mono'
  | 'monoLabel'
  | 'monoCode';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  /** Over imagery: always light, because it sits on a scrim in both schemes. */
  | 'onPhoto'
  | 'onPhotoMuted'
  /** Against an accent fill or the opposite ground. */
  | 'inverse';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /**
   * Which scheme's colours to resolve `tone` against. Dark is the refresh's
   * default ground. Passed explicitly until the light screens land and this
   * comes from context instead.
   */
  scheme?: ThemeName;
}

function toneColor(tone: TextTone, scheme: ThemeName): string {
  const t = theme[scheme];
  switch (tone) {
    case 'primary':
      return t.textPrimary;
    case 'secondary':
      return t.textSecondary;
    case 'muted':
      return t.textMuted;
    case 'accent':
      return t.accent;
    case 'onPhoto':
      return '#F7F5F4';
    case 'onPhotoMuted':
      return palette.warm[300];
    case 'inverse':
      return theme[scheme === 'dark' ? 'light' : 'dark'].textPrimary;
  }
}

export function Text({
  variant = 'body',
  tone = 'primary',
  scheme = 'dark',
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        variants[variant],
        { color: toneColor(tone, scheme) },
        style,
        // Last, so a caller's `style` cannot reintroduce a weight no loaded
        // face can serve. Safe to force because the app loads exactly three
        // files and in all three the weight is chosen by family name, not by
        // `fontWeight`: Alata has one face, and JetBrains Mono's regular and
        // medium are registered as separate families. So nothing here can
        // legitimately want a different number, and a stray `fontWeight` is
        // always a leftover from the monochrome styles being migrated.
        styles.singleWeight,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  singleWeight: { fontWeight: '400' },
});

/**
 * Letter-spacing is in points here, not em as in the handoff's CSS — the
 * conversion is `em × fontSize`, done at each size so the tracking matches
 * what the screens draw.
 */
const variants = StyleSheet.create({
  hero: { fontFamily: fontFamily.body, fontSize: 34, lineHeight: 36 },
  display: { fontFamily: fontFamily.body, fontSize: 30, lineHeight: 34 },
  title: { fontFamily: fontFamily.body, fontSize: 22, lineHeight: 26 },
  heading: { fontFamily: fontFamily.body, fontSize: 20, lineHeight: 24 },
  subtitle: { fontFamily: fontFamily.body, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fontFamily.body, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 23 },
  footnote: { fontFamily: fontFamily.body, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fontFamily.body, fontSize: 12, lineHeight: 16 },
  /** Category tags and section eyebrows: 0.2em at 11px. */
  overline: {
    fontFamily: fontFamily.body,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  /** Numerics, prices, counts: 0.1em at 13px. */
  mono: {
    fontFamily: fontFamily.mono,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1.3,
  },
  /** Small mono eyebrows: 0.2em at 11px. */
  monoLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  /** Ticket codes (`EK-CEMUDPNWLFM`): the medium face, 0.14em at 15px. */
  monoCode: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 2.1,
  },
});
