import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(128),
  displayName: z.string().min(1).max(80),
  acceptedTermsAt: z.string().datetime(),
  marketingConsent: z.boolean().default(false),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RequestPasswordResetSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(12).max(128),
});

export const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});
