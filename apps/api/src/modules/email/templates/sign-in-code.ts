import { emailLayout, escapeHtml } from './layout.js';

export interface SignInCodeData {
  /** The six digits. Shown as-is; never linked. */
  code: string;
  /** Display name, when we have one. */
  name?: string | null;
  /** How long the code stays valid, for the copy (e.g. "ten minutes"). */
  expiresInLabel?: string;
}

/**
 * The six-digit sign-in code.
 *
 * Deliberately has no button and no link. A code email that also contains a
 * one-tap link is the shape phishing copies most easily, and the whole point
 * of this route is that nothing in the message needs to be clicked — the
 * person types six digits into an app they already have open.
 *
 * The digits are spaced in the HTML for legibility but kept unspaced in the
 * plain-text part and in the subject, so that copy-and-paste and iOS's own
 * code detection both get something they can use.
 */
export function signInCodeTemplate(data: SignInCodeData) {
  const greeting = data.name ? `Hi ${escapeHtml(data.name)},` : 'Hi,';
  const expiry = data.expiresInLabel ?? 'ten minutes';
  const code = escapeHtml(data.code);

  const content = `
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#28251F;">
      Your sign-in code
    </h1>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      ${greeting} enter this code in the Ekklesia app to sign in.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td style="border-radius:8px;background:#F6F1E8;border:1px solid #E4DBC9;padding:18px 28px;">
          <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:30px;letter-spacing:0.28em;color:#28251F;">
            ${code}
          </span>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;color:#86827B;">
      This code expires in ${escapeHtml(expiry)} and can only be used once.
    </p>
    <p style="margin:12px 0 0;font-size:13px;color:#86827B;">
      If you didn't ask to sign in, you can ignore this email — someone may
      have typed your address by mistake. Nobody can get into your account
      with this message alone.
    </p>
  `;

  return {
    // The code is in the subject so it is readable from a notification
    // without opening anything.
    subject: `${data.code} is your Ekklesia sign-in code`,
    html: emailLayout(content, {
      previewText: `Your sign-in code is ${data.code}. It expires in ${expiry}.`,
    }),
    text:
      `Your Ekklesia sign-in code\n\n` +
      `${data.name ? `Hi ${data.name},\n\n` : ''}` +
      `Enter this code in the app to sign in:\n\n` +
      `${data.code}\n\n` +
      `It expires in ${expiry} and can only be used once.\n\n` +
      `If you didn't ask to sign in, you can ignore this email.\n`,
  };
}
