import type { Config } from 'tailwindcss';
import { color, spacing, radius, fontSize } from '@ekklesia/ui/tokens';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: color.brand,
        ink: color.ink,
        success: color.success,
        warning: color.warning,
        danger: color.danger,
        info: color.info,
      },
      spacing: Object.fromEntries(
        Object.entries(spacing).map(([k, v]) => [k, `${v}px`]),
      ),
      borderRadius: Object.fromEntries(
        Object.entries(radius).map(([k, v]) => [k, typeof v === 'number' ? `${v}px` : v]),
      ),
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([k, v]) => [k, `${v}px`]),
      ),
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
