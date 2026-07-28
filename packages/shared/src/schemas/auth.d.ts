import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    displayName: z.ZodString;
    acceptedTermsAt: z.ZodString;
    marketingConsent: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    displayName: string;
    acceptedTermsAt: string;
    marketingConsent: boolean;
}, {
    email: string;
    password: string;
    displayName: string;
    acceptedTermsAt: string;
    marketingConsent?: boolean | undefined;
}>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const RequestPasswordResetSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
    password: string;
}, {
    token: string;
    password: string;
}>;
export declare const VerifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    token: string;
}, {
    token: string;
}>;
//# sourceMappingURL=auth.d.ts.map