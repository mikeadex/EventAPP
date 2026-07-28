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

export const tokens = { color, spacing, radius, fontSize, fontWeight, shadow };
export type Tokens = typeof tokens;
