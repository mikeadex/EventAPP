"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyEmailSchema = exports.ResetPasswordSchema = exports.RequestPasswordResetSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
exports.RegisterSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(12).max(128),
    displayName: zod_1.z.string().min(1).max(80),
    acceptedTermsAt: zod_1.z.string().datetime(),
    marketingConsent: zod_1.z.boolean().default(false),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.RequestPasswordResetSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
exports.ResetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
    password: zod_1.z.string().min(12).max(128),
});
exports.VerifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1),
});
//# sourceMappingURL=auth.js.map