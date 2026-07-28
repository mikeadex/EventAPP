export const SUPPORTED_LOCALES = ['en-GB', 'en-US', 'en-IE'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const SUPPORTED_CURRENCIES = ['GBP', 'EUR', 'USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

export const SUPPORTED_COUNTRIES = [
  // UK + EU + US — initial launch markets
  'GB', 'IE', 'US',
  'FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'PT', 'AT', 'SE', 'DK', 'FI', 'NO',
  'PL', 'CZ', 'GR', 'HU', 'RO', 'BG', 'HR', 'SK', 'SI', 'EE', 'LV', 'LT',
  'LU', 'MT', 'CY',
] as const;
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];

export interface Money {
  amount: number; // minor units (pence/cents)
  currency: Currency;
}

export interface PageQuery {
  cursor?: string;
  limit?: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}
