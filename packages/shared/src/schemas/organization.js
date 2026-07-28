"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerificationStatus = exports.UpdateOrganizationSchema = exports.CreateOrganizationSchema = exports.OrgKind = void 0;
const zod_1 = require("zod");
const types_js_1 = require("../types.js");
exports.OrgKind = zod_1.z.enum(['church', 'ministry', 'community']);
exports.CreateOrganizationSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(120),
    slug: zod_1.z
        .string()
        .min(3)
        .max(60)
        .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'lowercase, hyphens, no leading/trailing dash'),
    kind: exports.OrgKind.default('church'),
    country: zod_1.z.enum(types_js_1.SUPPORTED_COUNTRIES),
    currency: zod_1.z.enum(types_js_1.SUPPORTED_CURRENCIES),
    websiteUrl: zod_1.z.string().url().optional(),
    shortDescription: zod_1.z.string().max(280).optional(),
});
exports.UpdateOrganizationSchema = exports.CreateOrganizationSchema.partial().omit({
    slug: true,
    country: true,
});
exports.VerificationStatus = zod_1.z.enum([
    'unverified',
    'pending',
    'verified',
    'rejected',
    'suspended',
]);
//# sourceMappingURL=organization.js.map