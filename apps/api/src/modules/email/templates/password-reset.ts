import { emailLayout, escapeHtml } from './layout.js';

export interface PasswordResetData {
  /** Full reset link (verifies the token then deep-links back into the app). */
  url: string;
  /** Display name, when we have one. */
  name?: string | null;
  /** How long the link stays valid, for the copy (e.g. "1 hour"). */
  expiresInLabel?: string;
}

export function passwordResetEmail(data: PasswordResetData) {
  const greeting = data.name ? `Hi ${escapeHtml(data.name)},` : 'Hi,';
  const expiry = data.expiresInLabel ?? '1 hour';

  const content = `
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#28251F;">
      Reset your password
    </h1>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      ${greeting} we received a request to reset the password for your Ekklesia
      account. Tap the button below to choose a new one.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td style="border-radius:8px;background:#B17A2C;">
          <a href="${escapeHtml(data.url)}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;">
            Reset password
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:#86827B;">
      This link expires in ${escapeHtml(expiry)}. If you didn't request a reset,
      you can safely ignore this email — your password won't change.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#B5B2AC;word-break:break-all;">
      Trouble with the button? Paste this link into your browser:<br />
      ${escapeHtml(data.url)}
    </p>
  `;

  return {
    subject: 'Reset your Ekklesia password',
    html: emailLayout(content, {
      previewText: 'Reset your Ekklesia password (link expires soon).',
    }),
    text:
      `Reset your Ekklesia password\n\n` +
      `${data.name ? `Hi ${data.name},\n\n` : ''}` +
      `We received a request to reset your password. Open this link to choose a new one (expires in ${expiry}):\n` +
      `${data.url}\n\n` +
      `If you didn't request this, you can safely ignore this email.\n`,
  };
}
