import { emailLayout, escapeHtml } from './layout.js';

export interface RsvpConfirmationData {
  attendeeName: string;
  organizationName: string;
  eventTitle: string;
  eventStartsAt: Date;
  eventTimezone: string;
  ticketCode: string;
  ticketUrl: string;
  venueLine: string | null;
  isOnline: boolean;
}

export function rsvpConfirmationEmail(data: RsvpConfirmationData) {
  const startStr = data.eventStartsAt.toLocaleString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: data.eventTimezone,
  });

  const whereLine = data.isOnline
    ? 'Online — joining details will be in your ticket.'
    : data.venueLine ?? 'Location to be confirmed.';

  const content = `
    <h1 style="margin:0;font-family:Georgia,serif;font-size:28px;line-height:1.2;color:#28251F;">
      You're going to ${escapeHtml(data.eventTitle)}
    </h1>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      Thanks, ${escapeHtml(data.attendeeName)} — your RSVP for
      ${escapeHtml(data.organizationName)} is confirmed.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border:1px solid #EFEEEC;border-radius:12px;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #EFEEEC;">
          <p style="margin:0;font-size:11px;color:#86827B;text-transform:uppercase;letter-spacing:1px;">When</p>
          <p style="margin:4px 0 0;font-size:15px;color:#28251F;">${escapeHtml(startStr)}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#86827B;">${escapeHtml(data.eventTimezone)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #EFEEEC;">
          <p style="margin:0;font-size:11px;color:#86827B;text-transform:uppercase;letter-spacing:1px;">Where</p>
          <p style="margin:4px 0 0;font-size:15px;color:#28251F;">${escapeHtml(whereLine)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0;font-size:11px;color:#86827B;text-transform:uppercase;letter-spacing:1px;">Ticket code</p>
          <p style="margin:4px 0 0;font-family:Menlo,Courier,monospace;font-size:16px;letter-spacing:2px;color:#28251F;">
            ${escapeHtml(data.ticketCode)}
          </p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td style="border-radius:8px;background:#B17A2C;">
          <a href="${escapeHtml(data.ticketUrl)}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;">
            View your ticket
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:28px 0 0;font-size:13px;color:#86827B;">
      Plans change? You can cancel your RSVP anytime from your ticket page.
    </p>
  `;

  return {
    subject: `You're going: ${data.eventTitle}`,
    html: emailLayout(content, {
      previewText: `Your RSVP for ${data.eventTitle} is confirmed.`,
    }),
    text:
      `You're going to ${data.eventTitle}\n\n` +
      `When: ${startStr} (${data.eventTimezone})\n` +
      `Where: ${whereLine}\n` +
      `Ticket code: ${data.ticketCode}\n\n` +
      `View your ticket: ${data.ticketUrl}\n`,
  };
}
