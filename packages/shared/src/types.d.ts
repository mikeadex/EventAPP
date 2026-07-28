export declare const SUPPORTED_LOCALES: readonly ["en-GB", "en-US", "en-IE"];
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export declare const SUPPORTED_CURRENCIES: readonly ["GBP", "EUR", "USD"];
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];
export declare const SUPPORTED_COUNTRIES: readonly ["GB", "IE", "US", "FR", "DE", "ES", "IT", "NL", "BE", "PT", "AT", "SE", "DK", "FI", "NO", "PL", "CZ", "GR", "HU", "RO", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "LU", "MT", "CY"];
export type CountryCode = (typeof SUPPORTED_COUNTRIES)[number];
export interface Money {
    amount: number;
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
//# sourceMappingURL=types.d.ts.map