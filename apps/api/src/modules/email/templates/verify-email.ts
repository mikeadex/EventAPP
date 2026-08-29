import { emailLayout, escapeHtml } from './layout.js';

export interface VerifyEmailData {
  /** Full verification link (consumes the token, then redirects on). */
  url: string;
  /** Display name, when we have one. */
  name?: string | null;
  /** How long the link stays valid, for the copy (e.g. "24 hours"). */
  expiresInLabel?: string;
}

export function verifyEmailTemplate(data: VerifyEmailData) {
  const greeting = data.name ? `Hi ${escapeHtml(data.name)},` : 'Hi,';
  const expiry = data.expiresInLabel ?? '24 hours';

  const content = `
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#28251F;">
      Confirm your email
    </h1>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      ${greeting} welcome to Ekklesia. Tap the button below to confirm this
      address and finish setting up your account.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td style="border-radius:8px;background:#B17A2C;">
          <a href="${escapeHtml(data.url)}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;">
            Confirm email
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:#86827B;">
      This link expires in ${escapeHtml(expiry)}. If you didn't create an
      Ekklesia account, you can safely ignore this email.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#B5B2AC;word-break:break-all;">
      Trouble with the button? Paste this link into your browser:<br />
      ${escapeHtml(data.url)}
    </p>
  `;

  return {
    subject: 'Confirm your Ekklesia email',
    html: emailLayout(content, {
      previewText: 'Confirm your email to finish setting up Ekklesia.',
    }),
    text:
      `Confirm your Ekklesia email\n\n` +
      `${data.name ? `Hi ${data.name},\n\n` : ''}` +
      `Welcome to Ekklesia. Open this link to confirm your address (expires in ${expiry}):\n` +
      `${data.url}\n\n` +
      `If you didn't create an account, you can safely ignore this email.\n`,
  };
}
