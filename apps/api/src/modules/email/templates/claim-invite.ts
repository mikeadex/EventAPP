import { emailLayout, escapeHtml } from './layout.js';

// TODO(confirm): final copy for the claim emails.

export interface ClaimEmailData {
  /** The church's name as it appears on its page. */
  orgName: string;
  /** Who we're writing to, when staff recorded a name. */
  contactName?: string | null;
  /** `${WEB_URL}/claim/<token>`. */
  claimUrl: string;
  /** `${WEB_URL}/takedown/<token>`. */
  takedownUrl: string;
  /** How long the claim link stays valid, for the copy (e.g. "7 days"). */
  expiresInLabel?: string;
}

/** Not an account holder (yet), so the default layout footer would be wrong. */
export const CLAIM_EMAIL_FOOTER =
  "You're receiving this because the Ekklesia team listed your church's events. Questions? Reply to this email.";

export function claimButton(url: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;">
      <tr>
        <td style="border-radius:8px;background:#B17A2C;">
          <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

/** The "not yours?" paragraph, in HTML and in plain text. */
export function takedownParts(data: ClaimEmailData): { html: string; text: string } {
  return {
    html: `
    <p style="margin:24px 0 0;font-size:14px;color:#5E5A52;">
      Not your church, or you'd rather not be listed?
      <a href="${escapeHtml(data.takedownUrl)}" style="color:#B17A2C;">Take it down</a>
      and we'll remove the page and its events straight away.
    </p>`,
    text:
      `Not your church, or you'd rather not be listed? Open this link and we'll ` +
      `remove the page and its events straight away:\n${data.takedownUrl}\n\n`,
  };
}

export function claimInviteEmail(data: ClaimEmailData) {
  const greeting = data.contactName ? `Hi ${escapeHtml(data.contactName)},` : 'Hi,';
  const org = escapeHtml(data.orgName);
  const expiry = data.expiresInLabel ?? '7 days';
  const takedown = takedownParts(data);

  const content = `
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#28251F;">
      Your church's events are on Ekklesia
    </h1>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      ${greeting} the Ekklesia team has added a page for ${org} so people nearby
      can find your events. It's live now.
    </p>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      Claim it to take it over: see who's coming, check people in at the door,
      and edit your events. It's free, and only takes a minute.
    </p>
    ${claimButton(data.claimUrl, 'Claim your page')}
    <p style="margin:16px 0 0;font-size:13px;color:#86827B;">
      This link works for ${escapeHtml(expiry)}.
    </p>
    ${takedown.html}
    <p style="margin:16px 0 0;font-size:12px;color:#B5B2AC;word-break:break-all;">
      Trouble with the button? Paste this link into your browser:<br />
      ${escapeHtml(data.claimUrl)}
    </p>
  `;

  return {
    subject: "Your church's events are on Ekklesia",
    html: emailLayout(content, {
      previewText: `We've added ${data.orgName} to Ekklesia. Claim your page to manage it.`,
      footer: CLAIM_EMAIL_FOOTER,
    }),
    text:
      `Your church's events are on Ekklesia\n\n` +
      `${data.contactName ? `Hi ${data.contactName},\n\n` : ''}` +
      `The Ekklesia team has added a page for ${data.orgName} so people nearby can ` +
      `find your events. It's live now.\n\n` +
      `Claim it to take it over: see who's coming, check people in at the door, and ` +
      `edit your events. Open this link (it works for ${expiry}):\n${data.claimUrl}\n\n` +
      takedown.text,
  };
}
