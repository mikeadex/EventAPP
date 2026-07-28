"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CheckInSchema = exports.ReserveTicketsSchema = exports.TicketStatus = void 0;
const zod_1 = require("zod");
exports.TicketStatus = zod_1.z.enum([
    'reserved',
    'issued',
    'checked_in',
    'cancelled',
    'refunded',
    'expired',
]);
exports.ReserveTicketsSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    items: zod_1.z
        .array(zod_1.z.object({
        ticketTypeId: zod_1.z.string().uuid(),
        quantity: zod_1.z.number().int().min(1).max(50),
    }))
        .min(1)
        .max(20),
});
exports.CheckInSchema = zod_1.z.object({
    ticketCode: zod_1.z.string().min(6).max(64),
    eventId: zod_1.z.string().uuid(),
});
//# sourceMappingURL=ticket.js.map