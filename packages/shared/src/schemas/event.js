"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventSearchSchema = exports.CreateEventSchema = exports.VenueInput = exports.TicketTypeInput = exports.EventCategory = exports.EventVisibility = exports.EventStatus = void 0;
const zod_1 = require("zod");
const types_js_1 = require("../types.js");
exports.EventStatus = zod_1.z.enum([
    'draft',
    'scheduled',
    'published',
    'cancelled',
    'completed',
]);
exports.EventVisibility = zod_1.z.enum(['public', 'unlisted', 'members_only']);
exports.EventCategory = zod_1.z.enum([
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
exports.TicketTypeInput = zod_1.z.object({
    name: zod_1.z.string().min(1).max(80),
    description: zod_1.z.string().max(500).optional(),
    priceMinor: zod_1.z.number().int().min(0),
    currency: zod_1.z.enum(types_js_1.SUPPORTED_CURRENCIES),
    quantity: zod_1.z.number().int().min(1).max(1_000_000),
    perOrderMax: zod_1.z.number().int().min(1).max(50).default(10),
    salesStart: zod_1.z.string().datetime().optional(),
    salesEnd: zod_1.z.string().datetime().optional(),
});
exports.VenueInput = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    addressLine1: zod_1.z.string().max(200),
    addressLine2: zod_1.z.string().max(200).optional(),
    city: zod_1.z.string().max(120),
    region: zod_1.z.string().max(120).optional(),
    postalCode: zod_1.z.string().max(20),
    country: zod_1.z.string().length(2),
    latitude: zod_1.z.number().min(-90).max(90).optional(),
    longitude: zod_1.z.number().min(-180).max(180).optional(),
});
exports.CreateEventSchema = zod_1.z
    .object({
    title: zod_1.z.string().min(3).max(140),
    summary: zod_1.z.string().max(280).optional(),
    description: zod_1.z.string().max(10_000).optional(),
    category: exports.EventCategory,
    visibility: exports.EventVisibility.default('public'),
    startsAt: zod_1.z.string().datetime(),
    endsAt: zod_1.z.string().datetime(),
    timezone: zod_1.z.string().min(1).max(64), // IANA TZ
    isOnline: zod_1.z.boolean().default(false),
    onlineUrl: zod_1.z.string().url().optional(),
    venue: exports.VenueInput.optional(),
    capacity: zod_1.z.number().int().min(1).max(1_000_000).optional(),
    coverImageUrl: zod_1.z.string().url().optional(),
    ticketTypes: zod_1.z.array(exports.TicketTypeInput).max(20).default([]),
})
    .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), {
    message: 'endsAt must be after startsAt',
    path: ['endsAt'],
})
    .refine((v) => v.isOnline || v.venue, {
    message: 'In-person events require a venue',
    path: ['venue'],
});
exports.EventSearchSchema = zod_1.z.object({
    q: zod_1.z.string().max(120).optional(),
    category: exports.EventCategory.optional(),
    country: zod_1.z.string().length(2).optional(),
    city: zod_1.z.string().max(120).optional(),
    startsAfter: zod_1.z.string().datetime().optional(),
    startsBefore: zod_1.z.string().datetime().optional(),
    free: zod_1.z.boolean().optional(),
    cursor: zod_1.z.string().optional(),
    limit: zod_1.z.number().int().min(1).max(50).default(20),
});
//# sourceMappingURL=event.js.map