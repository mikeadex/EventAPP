import { z } from 'zod';
export declare const PaymentStatus: z.ZodEnum<["pending", "processing", "succeeded", "failed", "refunded", "partially_refunded", "disputed"]>;
export type PaymentStatus = z.infer<typeof PaymentStatus>;
export declare const PayoutStatus: z.ZodEnum<["not_started", "onboarding", "restricted", "enabled", "disabled"]>;
export type PayoutStatus = z.infer<typeof PayoutStatus>;
export declare const CreateCheckoutSessionSchema: z.ZodObject<{
    orderId: z.ZodString;
    returnUrl: z.ZodString;
    cancelUrl: z.ZodString;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    returnUrl: string;
    cancelUrl: string;
}, {
    orderId: string;
    returnUrl: string;
    cancelUrl: string;
}>;
export declare const CreateDonationSchema: z.ZodObject<{
    organizationId: z.ZodString;
    amountMinor: z.ZodNumber;
    currency: z.ZodEnum<["GBP", "EUR", "USD"]>;
    message: z.ZodOptional<z.ZodString>;
    anonymous: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    currency: "GBP" | "EUR" | "USD";
    organizationId: string;
    amountMinor: number;
    anonymous: boolean;
    message?: string | undefined;
}, {
    currency: "GBP" | "EUR" | "USD";
    organizationId: string;
    amountMinor: number;
    message?: string | undefined;
    anonymous?: boolean | undefined;
}>;
export declare const RefundSchema: z.ZodObject<{
    paymentId: z.ZodString;
    amountMinor: z.ZodOptional<z.ZodNumber>;
    reason: z.ZodEnum<["requested_by_customer", "duplicate", "fraudulent", "other"]>;
    note: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    paymentId: string;
    reason: "other" | "requested_by_customer" | "duplicate" | "fraudulent";
    amountMinor?: number | undefined;
    note?: string | undefined;
}, {
    paymentId: string;
    reason: "other" | "requested_by_customer" | "duplicate" | "fraudulent";
    amountMinor?: number | undefined;
    note?: string | undefined;
}>;
//# sourceMappingURL=payment.d.ts.map