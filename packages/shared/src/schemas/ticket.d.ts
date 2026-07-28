import { z } from 'zod';
export declare const TicketStatus: z.ZodEnum<["reserved", "issued", "checked_in", "cancelled", "refunded", "expired"]>;
export type TicketStatus = z.infer<typeof TicketStatus>;
export declare const ReserveTicketsSchema: z.ZodObject<{
    eventId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        ticketTypeId: z.ZodString;
        quantity: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        ticketTypeId: string;
    }, {
        quantity: number;
        ticketTypeId: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    eventId: string;
    items: {
        quantity: number;
        ticketTypeId: string;
    }[];
}, {
    eventId: string;
    items: {
        quantity: number;
        ticketTypeId: string;
    }[];
}>;
export type ReserveTicketsInput = z.infer<typeof ReserveTicketsSchema>;
export declare const CheckInSchema: z.ZodObject<{
    ticketCode: z.ZodString;
    eventId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    eventId: string;
    ticketCode: string;
}, {
    eventId: string;
    ticketCode: string;
}>;
//# sourceMappingURL=ticket.d.ts.map