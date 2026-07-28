import { z } from 'zod';
import { SUPPORTED_CURRENCIES } from '../types.js';

export const EventStatus = z.enum([
  'draft',
  'scheduled',
  'published',
  'cancelled',
  'completed',
]);
export type EventStatus = z.infer<typeof EventStatus>;

export const EventVisibility = z.enum(['public', 'unlisted', 'members_only']);
export type EventVisibility = z.infer<typeof EventVisibility>;

export const EventCategory = z.enum([
  'service',
  'worship',
  'prayer',
  'youth',
  'kids',
  'small_group',
  'conference',
  'outreach',
  'social',
  'fundraiser',
  'class',
  'other',
]);
export type EventCategory = z.infer<typeof EventCategory>;

export const TicketTypeInput = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  priceMinor: z.number().int().min(0),
  currency: z.enum(SUPPORTED_CURRENCIES),
  quantity: z.number().int().min(1).max(1_000_000),
  perOrderMax: z.number().int().min(1).max(50).default(10),
  salesStart: z.string().datetime().optional(),
  salesEnd: z.string().datetime().optional(),
});

export const VenueInput = z.object({
  name: z.string().min(1).max(200),
  addressLine1: z.string().max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(120),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(20),
  country: z.string().length(2),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const CreateEventSchema = z
  .object({
    title: z.string().min(3).max(140),
    summary: z.string().max(280).optional(),
    description: z.string().max(10_000).optional(),
    category: EventCategory,
    visibility: EventVisibility.default('public'),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: z.string().min(1).max(64), // IANA TZ
    isOnline: z.boolean().default(false),
    onlineUrl: z.string().url().optional(),
    venue: VenueInput.optional(),
    capacity: z.number().int().min(1).max(1_000_000).optional(),
    coverImageUrl: z.string().url().optional(),
    ticketTypes: z.array(TicketTypeInput).max(20).default([]),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
  })
  .refine((v) => v.isOnline || v.venue, {
    message: 'In-person events require a venue',
    path: ['venue'],
  });

export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = z.object({
  title: z.string().min(3).max(140).optional(),
  summary: z.string().max(280).optional(),
  description: z.string().max(10_000).optional(),
  category: EventCategory.optional(),
  visibility: EventVisibility.optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  timezone: z.string().min(1).max(64).optional(),
  isOnline: z.boolean().optional(),
  onlineUrl: z.string().url().nullable().optional(),
  venue: VenueInput.nullable().optional(),
  capacity: z.number().int().min(1).max(1_000_000).nullable().optional(),
  coverImageUrl: z.string().url().nullable().optional(),
});
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

// Query-string-friendly: coerce numbers/booleans from string params.
export const EventSearchSchema = z.object({
  q: z.string().max(120).optional(),
  category: EventCategory.optional(),
  country: z.string().length(2).optional(),
  city: z.string().max(120).optional(),
  startsAfter: z.string().datetime().optional(),
  startsBefore: z.string().datetime().optional(),
  free: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type EventSearchInput = z.infer<typeof EventSearchSchema>;
