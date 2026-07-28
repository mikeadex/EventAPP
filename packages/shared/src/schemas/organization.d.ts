import { z } from 'zod';
export declare const OrgKind: z.ZodEnum<["church", "ministry", "community"]>;
export type OrgKind = z.infer<typeof OrgKind>;
export declare const CreateOrganizationSchema: z.ZodObject<{
    name: z.ZodString;
    slug: z.ZodString;
    kind: z.ZodDefault<z.ZodEnum<["church", "ministry", "community"]>>;
    country: z.ZodEnum<["GB", "IE", "US", "FR", "DE", "ES", "IT", "NL", "BE", "PT", "AT", "SE", "DK", "FI", "NO", "PL", "CZ", "GR", "HU", "RO", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "LU", "MT", "CY"]>;
    currency: z.ZodEnum<["GBP", "EUR", "USD"]>;
    websiteUrl: z.ZodOptional<z.ZodString>;
    shortDescription: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    slug: string;
    kind: "church" | "ministry" | "community";
    country: "GB" | "IE" | "US" | "FR" | "DE" | "ES" | "IT" | "NL" | "BE" | "PT" | "AT" | "SE" | "DK" | "FI" | "NO" | "PL" | "CZ" | "GR" | "HU" | "RO" | "BG" | "HR" | "SK" | "SI" | "EE" | "LV" | "LT" | "LU" | "MT" | "CY";
    currency: "GBP" | "EUR" | "USD";
    websiteUrl?: string | undefined;
    shortDescription?: string | undefined;
}, {
    name: string;
    slug: string;
    country: "GB" | "IE" | "US" | "FR" | "DE" | "ES" | "IT" | "NL" | "BE" | "PT" | "AT" | "SE" | "DK" | "FI" | "NO" | "PL" | "CZ" | "GR" | "HU" | "RO" | "BG" | "HR" | "SK" | "SI" | "EE" | "LV" | "LT" | "LU" | "MT" | "CY";
    currency: "GBP" | "EUR" | "USD";
    kind?: "church" | "ministry" | "community" | undefined;
    websiteUrl?: string | undefined;
    shortDescription?: string | undefined;
}>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export declare const UpdateOrganizationSchema: z.ZodObject<Omit<{
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
    kind: z.ZodOptional<z.ZodDefault<z.ZodEnum<["church", "ministry", "community"]>>>;
    country: z.ZodOptional<z.ZodEnum<["GB", "IE", "US", "FR", "DE", "ES", "IT", "NL", "BE", "PT", "AT", "SE", "DK", "FI", "NO", "PL", "CZ", "GR", "HU", "RO", "BG", "HR", "SK", "SI", "EE", "LV", "LT", "LU", "MT", "CY"]>>;
    currency: z.ZodOptional<z.ZodEnum<["GBP", "EUR", "USD"]>>;
    websiteUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    shortDescription: z.ZodOptional<z.ZodOptional<z.ZodString>>;
}, "slug" | "country">, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    kind?: "church" | "ministry" | "community" | undefined;
    currency?: "GBP" | "EUR" | "USD" | undefined;
    websiteUrl?: string | undefined;
    shortDescription?: string | undefined;
}, {
    name?: string | undefined;
    kind?: "church" | "ministry" | "community" | undefined;
    currency?: "GBP" | "EUR" | "USD" | undefined;
    websiteUrl?: string | undefined;
    shortDescription?: string | undefined;
}>;
export declare const VerificationStatus: z.ZodEnum<["unverified", "pending", "verified", "rejected", "suspended"]>;
export type VerificationStatus = z.infer<typeof VerificationStatus>;
//# sourceMappingURL=organization.d.ts.map