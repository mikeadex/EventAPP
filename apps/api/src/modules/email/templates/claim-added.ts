import {
  CLAIM_EMAIL_FOOTER,
  claimButton,
  takedownParts,
  type ClaimEmailData,
} from './claim-invite.js';
import { emailLayout, escapeHtml } from './layout.js';

// TODO(confirm): final copy for the claim emails.

/**
 * The claim email for an address that already has an Ekklesia account: same
 * claim link, but it asks them to sign in rather than set up a password.
 */
export function claimAddedEmail(data: ClaimEmailData) {
  const greeting = data.contactName ? `Hi ${escapeHtml(data.contactName)},` : 'Hi,';
  const org = escapeHtml(data.orgName);
  const expiry = data.expiresInLabel ?? '7 days';
  const takedown = takedownParts(data);

  const content = `
    <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;line-height:1.2;color:#28251F;">
      We've added ${org} to Ekklesia
    </h1>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      ${greeting} the Ekklesia team has added a page for ${org} so people nearby
      can find your events. It's live now.
    </p>
    <p style="margin:12px 0 0;color:#5E5A52;font-size:15px;">
      You already have an account with us, so just sign in to manage it: see
      who's coming, check people in at the door, and edit your events.
    </p>
    ${claimButton(data.claimUrl, 'Sign in to manage it')}
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
    subject: `We've added ${data.orgName} to Ekklesia`,
    html: emailLayout(content, {
      previewText: `Sign in to manage ${data.orgName} on Ekklesia.`,
      footer: CLAIM_EMAIL_FOOTER,
    }),
    text:
      `We've added ${data.orgName} to Ekklesia\n\n` +
      `${data.contactName ? `Hi ${data.contactName},\n\n` : ''}` +
      `The Ekklesia team has added a page for ${data.orgName} so people nearby can ` +
      `find your events. It's live now.\n\n` +
      `You already have an account with us, so just sign in to manage it: see who's ` +
      `coming, check people in at the door, and edit your events. Open this link ` +
      `(it works for ${expiry}):\n${data.claimUrl}\n\n` +
      takedown.text,
  };
}
