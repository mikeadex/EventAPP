/**
 * Ekklesia design tokens. Cross-runtime — usable in Next.js (Tailwind theme)
 * and React Native (StyleSheet). Hex strings; no platform-specific imports.
 */

export const color = {
  // Monochrome design language: UI chrome is strictly black / white / grayscale.
  // (User-uploaded event & host photos still render in full colour — only the
  // interface is neutral.) `brand` is the near-black accent used for primary
  // actions, active states and emphasis; `ink` is the neutral surface/text ramp.
  brand: {
    50: '#F5F5F5',
    100: '#EAEAEA',
    200: '#D4D4D4',
    300: '#A8A8A8',
    400: '#737373',
    500: '#363636',
    600: '#111111', // primary (near-black, softer than pure #000)
    700: '#0A0A0A',
    800: '#000000',
    900: '#000000',
  },
  ink: {
    0: '#FFFFFF',
    50: '#FAFAFA',
    100: '#F2F2F2',
    200: '#E4E4E4',
    300: '#CFCFCF',
    400: '#9A9A9A',
    500: '#6B6B6B',
    600: '#474747',
    700: '#2A2A2A',
    800: '#171717',
    900: '#0A0A0A',
  },
  // Semantic tokens kept neutral so the palette stays strictly monochrome.
  // Meaning is carried by icons, weight and copy rather than hue. (Swap in a
  // single functional accent here later if we ever want coloured error/success.)
  success: '#171717',
  warning: '#474747',
  danger: '#0A0A0A',
  info: '#363636',
} as const;

export const spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
  '6xl': 60,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const shadow = {
  sm: '0 1px 2px rgba(10, 9, 7, 0.06)',
  md: '0 4px 12px rgba(10, 9, 7, 0.08)',
  lg: '0 12px 32px rgba(10, 9, 7, 0.10)',
} as const;

/* ------------------------------------------------------------------ *
 * 2026-11 refresh — coral accent, warm neutrals, dark-first, two themes
 *
 * Added alongside `color` rather than replacing it. Forty-two files read
 * `color.ink[…]` / `color.brand[…]` today; swapping those values would
 * restyle every screen at once with nothing verified. Screens move onto
 * `theme` as each is rebuilt, and `color` is deleted when the last one has.
 *
 * Values are taken from the handoff screens themselves
 * (`data-screen-label` blocks), not from the summary table, and the base
 * Nocturne system's own palette is deliberately NOT used — these screens
 * override its blurple/Inter with coral/Alata.
 * ------------------------------------------------------------------ */

/** Raw ramps. Prefer `theme` below; reach for these only for tints. */
export const palette = {
  /**
   * Coral. `400` is the accent on dark grounds; `600` is the accent on light,
   * because `400` fails contrast on white. `800` is the deep end of the mark
   * gradient.
   */
  coral: {
    100: '#FCE5E0',
    200: '#FFC9C2',
    300: '#F9A99D',
    400: '#F98E80',
    500: '#E5614F',
    600: '#C4392C',
    700: '#A32C21',
    800: '#7E1D14',
    900: '#5C1510',
  },
  /**
   * Warm neutrals — tinted toward the coral, not the neutral greys of the
   * monochrome system. Dark grounds live at 900–950, light grounds at 25–200.
   */
  warm: {
    0: '#FFFFFF',
    25: '#FFFAF9',
    50: '#F7F5F4',
    100: '#FFF1EE',
    200: '#F6E9E5',
    300: '#C3B8BA',
    350: '#C9BFC2',
    400: '#A9878A',
    500: '#8E8386',
    550: '#7E7376',
    600: '#6B5457',
    700: '#574446',
    750: '#5E4A4C',
    800: '#241618',
    850: '#1B1517',
    900: '#131013',
    950: '#0D0A0B',
  },
} as const;

/** Semantic roles. This is what screens should consume. */
export const theme = {
  dark: {
    background: palette.warm[900],
    backgroundDeep: palette.warm[950],
    surface: palette.warm[850],
    surfaceRaised: palette.warm[800],
    textPrimary: '#F2F0EF',
    textSecondary: palette.warm[500],
    textMuted: palette.warm[550],
    border: palette.warm[700],
    borderSubtle: palette.warm[750],
    accent: palette.coral[400],
    accentTint: palette.coral[200],
    accentPressed: palette.coral[500],
    /** Scrim over photography so overlaid text stays light. */
    scrim: 'rgba(13, 10, 11, 0.55)',
  },
  light: {
    background: palette.warm[25],
    backgroundDeep: palette.warm[50],
    surface: palette.warm[100],
    surfaceRaised: palette.warm[200],
    textPrimary: '#1A0F0D',
    textSecondary: palette.warm[600],
    textMuted: palette.warm[700],
    border: palette.warm[300],
    borderSubtle: palette.warm[350],
    accent: palette.coral[600],
    accentTint: palette.coral[100],
    accentPressed: palette.coral[700],
    /** Inverted per the spec: light scrim keeps overlaid text dark. */
    scrim: 'rgba(255, 250, 249, 0.55)',
  },
} as const;

export type ThemeName = keyof typeof theme;
export type ThemeColors = (typeof theme)[ThemeName];

/**
 * Font families.
 *
 * Alata carries all UI text — in the handoff it is declared once per screen
 * root and inherited, which is why it appears far less often than the mono
 * face in a naive grep. JetBrains Mono is applied deliberately, to ticket
 * codes (`EK-CEMUDPNWLFM`), prices and numeric labels, usually with wide
 * letter-spacing.
 *
 * Names match the exports of `@expo-google-fonts/*`. The app currently loads
 * no fonts at all and renders in the system face, so nothing reads these until
 * the loader lands.
 */
export const fontFamily = {
  body: 'Alata_400Regular',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

/** Letter-spacing the mono labels rely on; they read as cramped without it. */
export const letterSpacing = {
  normal: 0,
  wide: 0.06 * 13,
  wider: 0.16 * 14,
} as const;

/**
 * Radii the refresh uses that the original scale has no step for. Additive —
 * the keys above keep their values so existing screens are untouched.
 */
export const radiusExtra = {
  hairline: 2,
  card: 14,
  sheet: 18,
  hero: 34,
} as const;

export const tokens = { color, spacing, radius, fontSize, fontWeight, shadow };
export type Tokens = typeof tokens;

/** The refresh's tokens, grouped for convenience. */
export const refresh = {
  palette,
  theme,
  fontFamily,
  letterSpacing,
  radiusExtra,
};
