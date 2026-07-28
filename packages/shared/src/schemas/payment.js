"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundSchema = exports.CreateDonationSchema = exports.CreateCheckoutSessionSchema = exports.PayoutStatus = exports.PaymentStatus = void 0;
const zod_1 = require("zod");
const types_js_1 = require("../types.js");
exports.PaymentStatus = zod_1.z.enum([
    'pending',
    'processing',
    'succeeded',
    'failed',
    'refunded',
    'partially_refunded',
    'disputed',
]);
exports.PayoutStatus = zod_1.z.enum([
    'not_started',
    'onboarding',
    'restricted',
    'enabled',
    'disabled',
]);
exports.CreateCheckoutSessionSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    returnUrl: zod_1.z.string().url(),
    cancelUrl: zod_1.z.string().url(),
});
exports.CreateDonationSchema = zod_1.z.object({
    organizationId: zod_1.z.string().uuid(),
    amountMinor: zod_1.z.number().int().min(100), // min 1.00
    currency: zod_1.z.enum(types_js_1.SUPPORTED_CURRENCIES),
    message: zod_1.z.string().max(280).optional(),
    anonymous: zod_1.z.boolean().default(false),
});
exports.RefundSchema = zod_1.z.object({
    paymentId: zod_1.z.string().uuid(),
    amountMinor: zod_1.z.number().int().min(1).optional(), // omit = full refund
    reason: zod_1.z.enum(['requested_by_customer', 'duplicate', 'fraudulent', 'other']),
    note: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=payment.js.map