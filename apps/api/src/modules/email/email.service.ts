import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Used for transactional grouping in Resend; tags become searchable. */
  tags?: { name: string; value: string }[];
  /**
   * Throw instead of swallowing when the send fails.
   *
   * Off by default, which is right for mail that accompanies an action the
   * person has already completed — a ticket confirmation, a moderation
   * report. Losing those is bad but the action still happened.
   *
   * It is wrong for mail that *is* the action. A verification email that
   * silently fails leaves someone with an account they can never sign in to
   * (`requireEmailVerification` is on) and no error to tell them so. Those
   * callers pass `required` and let the failure reach the client, which
   * already knows how to offer a retry.
   */
  required?: boolean;
}

/** Thrown only for sends marked `required`. */
export class EmailSendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSendError';
  }
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
    // ekklesiaevents.com is the domain verified in Resend: it carries the
    // resend._domainkey DKIM record and the send.ekklesiaevents.com MAIL FROM.
    // The previous default here was no-reply@ekklesia.app — a domain that
    // belongs to somebody else entirely, has no Resend records, and that every
    // send would therefore be rejected for. A fallback should be the address
    // that works, not one that silently cannot.
    this.from = process.env.EMAIL_FROM ?? 'Ekklesia Events <no-reply@ekklesiaevents.com>';
    if (!key) {
      this.logger.warn(
        'RESEND_API_KEY not set — email send will log instead of dispatching.',
      );
      this.client = null;
    } else {
      this.client = new Resend(key);
    }
  }

  /**
   * Print the link an unsent email would have carried.
   *
   * Without this there is no way to verify an address or follow a reset on a
   * machine with no mail provider — the token exists only inside a message
   * that was never sent, so the whole flow is untestable locally and the only
   * way through is editing the database by hand.
   *
   * Guarded twice: only when the client is unconfigured (so never on a
   * working deployment) and never when NODE_ENV says production, because the
   * link carries a token that grants the action.
   */
  private logDevLink(input: SendEmailInput): void {
    if (process.env.NODE_ENV === 'production') return;
    const link = (input.text ?? input.html).match(/https?:\/\/[^\s"'<>)]+/)?.[0];
    if (link) this.logger.log(`[email:dev-noop] link: ${link}`);
  }

  async send(input: SendEmailInput): Promise<{ id: string | null }> {
    const fail = (reason: string): { id: string | null } => {
      this.logger.error(`Email send failed (${input.subject}): ${reason}`);
      if (input.required) throw new EmailSendError(reason);
      return { id: null };
    };

    if (!this.client) {
      this.logger.log(
        `[email:dev-noop] to=${input.to} subject="${input.subject}"`,
      );
      // Before the `required` check, not after: verification and reset are the
      // two mails a developer actually needs to follow, and they are exactly
      // the two that fail here. Logging after the throw would make the link
      // unreachable for every flow it was added to serve.
      this.logDevLink(input);
      // Unconfigured is still a failure for a `required` send: otherwise a
      // signup against a misconfigured deployment looks successful and
      // strands the account.
      if (input.required) return fail('RESEND_API_KEY is not configured');
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
      // Resend reports a rejected send in the body rather than by throwing —
      // an unverified `from` domain arrives here, not in the catch.
      if (res.error) return fail(res.error.message);
      return { id: res.data?.id ?? null };
    } catch (err) {
      if (err instanceof EmailSendError) throw err;
      return fail((err as Error).message);
    }
  }
}
