/**
 * Shared transactional-email layout. Inlines styles for maximum client
 * compatibility (Gmail strips <style> blocks aggressively). Keep this
 * minimal — we don't ship a full React Email renderer until volume warrants.
 */
export function emailLayout(content: string, opts: { previewText?: string } = {}): string {
  const preview = opts.previewText ?? '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Ekklesia</title>
  </head>
  <body style="margin:0;padding:0;background:#F8F8F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;color:#28251F;">
    <span style="display:none !important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(preview)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F8F7;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid #EFEEEC;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #EFEEEC;">
              <p style="margin:0;font-family:Georgia,serif;font-size:20px;color:#28251F;">Ekklesia</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #EFEEEC;background:#FBF6EE;font-size:12px;color:#86827B;">
              You're receiving this because you have an account at Ekklesia. Questions? Reply to this email.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
