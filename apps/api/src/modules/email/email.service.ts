import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Used for transactional grouping in Resend; tags become searchable. */
  tags?: { name: string; value: string }[];
}

/**
 * Thin Resend wrapper. If `RESEND_API_KEY` is not configured the service
 * logs the email and returns silently — this keeps local dev working without
 * a Resend account, but you still see the "would-have-sent" payload in logs.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend | null;
  private readonly from: string;

  constructor() {
    const key = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM ?? 'Ekklesia <no-reply@ekklesia.app>';
    if (!key) {
      this.logger.warn(
        'RESEND_API_KEY not set — email send will log instead of dispatching.',
      );
      this.client = null;
    } else {
      this.client = new Resend(key);
    }
  }

  async send(input: SendEmailInput): Promise<{ id: string | null }> {
    if (!this.client) {
      this.logger.log(
        `[email:dev-noop] to=${input.to} subject="${input.subject}"`,
      );
      return { id: null };
    }
    try {
      const res = await this.client.emails.send({
        from: this.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        tags: input.tags,
      });
      if (res.error) {
        this.logger.error(`Resend send failed: ${res.error.message}`);
        return { id: null };
      }
      return { id: res.data?.id ?? null };
    } catch (err) {
      // Never let an email failure surface to the caller — they've already
      // committed the user-facing action (RSVP, etc.). Log and move on.
      this.logger.error(`Email send threw: ${(err as Error).message}`);
      return { id: null };
    }
  }
}
