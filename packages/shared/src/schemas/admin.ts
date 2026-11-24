import { z } from 'zod';
import { CreateEventSchema } from './event.js';
import { OrgKind } from './organization.js';

/**
 * The countries a church can be added in, and the currency each one gets.
 * The same three launch markets, and the same currency for each, as host
 * sign-up offers (web and app), so a staff-added church is set up exactly as
 * one that signed itself up.
 */
export const ADMIN_HOST_COUNTRIES = ['GB', 'IE', 'US'] as const;
export const CURRENCY_FOR_COUNTRY = { GB: 'GBP', IE: 'EUR', US: 'USD' } as const;

const contactName = z.string().trim().min(1).max(120);
const contactEmail = z.string().trim().toLowerCase().email().max(254);

/** A church staff add on its behalf. It starts unclaimed and unverified. */
export const AdminChurchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  kind: OrgKind.default('church'),
  city: z.string().trim().min(1).max(120),
  country: z.enum(ADMIN_HOST_COUNTRIES),
  contactName,
  contactEmail,
});
export type AdminChurchInput = z.infer<typeof AdminChurchSchema>;

/** `POST /v1/admin/hosts`: a new church and its first event. */
export const AdminCreateHostSchema = z.object({
  church: AdminChurchSchema,
  event: CreateEventSchema,
});
export type AdminCreateHostInput = z.infer<typeof AdminCreateHostSchema>;

/** `PATCH /v1/admin/hosts/:id/contact`. A new claim email follows. */
export const AdminContactSchema = z.object({
  contactName: contactName.optional(),
  contactEmail,
});
export type AdminContactInput = z.infer<typeof AdminContactSchema>;

/** `POST /v1/admin/hosts/:id/restore`. */
export const AdminRestoreSchema = z.object({
  sendInvite: z.boolean().default(false),
});
export type AdminRestoreInput = z.infer<typeof AdminRestoreSchema>;

/** `POST /v1/admin/events/:id/unpublish`. Kept on the audit row and the cancellation. */
export const AdminUnpublishSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
export type AdminUnpublishInput = z.infer<typeof AdminUnpublishSchema>;
