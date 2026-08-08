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
  // Two distinct jobs: `shortDescription` is the one-line tagline under the
  // host's name and on cards; `description` is the fuller story on their page.
  shortDescription: z.string().max(280).optional(),
  description: z.string().max(5_000).optional(),
  logoUrl: z.string().url().optional(),

  // Supplied so a human can check the host is a real organisation before its
  // events are trusted. Optional here to keep older clients working: supplying
  // enough of them is what moves the host into the review queue.
  contactName: z.string().max(120).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().max(40).optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(120).optional(),
  postalCode: z.string().max(20).optional(),
});

/**
 * The answers a host must give before a reviewer has enough to go on. Anything
 * less and the organisation stays UNVERIFIED rather than entering the queue.
 */
export const VERIFICATION_REQUIRED_FIELDS = [
  'contactName',
  'contactEmail',
  'addressLine1',
  'city',
] as const;

export function isReadyForReview(input: {
  contactName?: string;
  contactEmail?: string;
  addressLine1?: string;
  city?: string;
}): boolean {
  return VERIFICATION_REQUIRED_FIELDS.every((f) => Boolean(input[f]?.trim()));
}
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
