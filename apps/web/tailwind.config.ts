import type { Config } from 'tailwindcss';

/**
 * The Ekklesia web palette. Every colour is a CSS variable defined per theme in
 * globals.css (`data-theme="dark|light"` on <html>), so one class works in both
 * themes. Never add hex values here — add a token to globals.css instead.
 *
 * The legacy `ink-*` / `brand-*` ramps are kept as aliases onto the new tokens
 * so long-form pages (privacy, terms, support, admin) that still use them stay
 * legible in both themes without being rewritten line by line.
 */
const v = (name: string) => `var(--${name})`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        raised: v('raised'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        avatar: v('avatar'),
        strong: v('strong'),
        ink: {
          DEFAULT: v('ink'),
          2: v('ink-2'),
          // legacy aliases
          0: v('surface'),
          50: v('raised'),
          100: v('line'),
          200: v('line-2'),
          300: v('line-3'),
          400: v('faint'),
          500: v('muted'),
          600: v('body'),
          700: v('ink-2'),
          800: v('ink'),
          900: v('strong'),
        },
        body: v('body'),
        muted: v('muted'),
        faint: v('faint'),
        accent: { DEFAULT: v('accent'), ink: v('accent-ink') },
        badge: { DEFAULT: v('badge'), ink: v('badge-ink') },
        line: { DEFAULT: v('line'), 2: v('line-2'), 3: v('line-3') },
        soft: v('soft'),
        softer: v('softer'),
        // legacy aliases
        brand: {
          50: v('softer'),
          100: v('soft'),
          200: v('line-2'),
          300: v('line-3'),
          500: v('accent'),
          600: v('accent'),
          700: v('accent-ink'),
        },
        danger: v('accent'),
        success: v('accent'),
      },
      fontFamily: {
        sans: ['Alata', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Alata', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card: '20px',
        panel: '24px',
        hero: '28px',
        field: '14px',
      },
      boxShadow: {
        panel: v('shadow'),
      },
      maxWidth: {
        page: '1240px',
      },
      screens: {
        // Breakpoints from the design (max-width 760 / 900 / 1024 / 1180).
        sm: '761px',
        md: '901px',
        lg: '1025px',
        xl: '1181px',
      },
    },
  },
  plugins: [],
};
export default config;
