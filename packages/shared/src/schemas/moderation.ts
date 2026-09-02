import { z } from 'zod';

/**
 * Why someone is reporting something.
 *
 * A fixed list rather than free text alone: it makes a queue triageable, and it
 * tells the person reporting that we have a category for what they saw — which
 * is part of why people bother to report at all.
 */
export const REPORT_REASONS = [
  'spam',
  'misleading',
  'hate_or_harassment',
  'sexual_content',
  'violence',
  'safeguarding',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const CreateReportSchema = z
  .object({
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
    eventId: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
    userId: z.string().min(1).optional(),
  })
  .refine(
    (v) => [v.eventId, v.organizationId, v.userId].filter(Boolean).length === 1,
    { message: 'Report exactly one of an event, an organisation or a user' },
  );
export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export const CreateBlockSchema = z
  .object({
    userId: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
  })
  .refine((v) => [v.userId, v.organizationId].filter(Boolean).length === 1, {
    message: 'Block exactly one of a user or an organisation',
  });
export type CreateBlockInput = z.infer<typeof CreateBlockSchema>;
