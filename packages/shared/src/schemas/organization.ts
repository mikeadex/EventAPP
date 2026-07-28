import { z } from 'zod';
import { SUPPORTED_COUNTRIES, SUPPORTED_CURRENCIES } from '../types.js';

export const OrgKind = z.enum(['church', 'ministry', 'community']);
export type OrgKind = z.infer<typeof OrgKind>;

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase, hyphens, no leading/trailing dash'),
  kind: OrgKind.default('church'),
  country: z.enum(SUPPORTED_COUNTRIES),
  currency: z.enum(SUPPORTED_CURRENCIES),
  websiteUrl: z.string().url().optional(),
  shortDescription: z.string().max(280).optional(),
  logoUrl: z.string().url().optional(),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial().omit({
  slug: true,
  country: true,
});

export const VerificationStatus = z.enum([
  'unverified',
  'pending',
  'verified',
  'rejected',
  'suspended',
]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;
