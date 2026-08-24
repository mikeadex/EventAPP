import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getAuth } from './auth.js';

/**
 * Hands a browser-established session to the native app.
 *
 * Social sign-in on a phone happens in a web view: the provider redirects back
 * to this API, and Better Auth sets a session **cookie**. The app cannot use
 * that — it authenticates with a bearer token from SecureStore, and
 * deliberately sends no cookies (see auth-client.ts; replaying a stale cookie
 * broke CSRF checks). So the session has to cross from the web view to the app
 * somehow.
 *
 * The crossing is a one-time token: minted here from the cookie session, passed
 * on the deep link, and immediately exchanged by the app for a real session.
 * It is single-use and short-lived, so a link left in a log or history is spent
 * rather than a standing credential. Hand-rolling this would have meant
 * inventing the same primitive with worse review.
 */
@Controller('native-auth')
export class NativeAuthController {
  @Get('handoff')
  async handoff(@Req() req: Request, @Res() res: Response) {
    const scheme = process.env.MOBILE_DEEPLINK_SCHEME ?? 'ekklesia';
    const target = `${scheme}://auth/social`;

    // This is also the errorCallbackURL for the native flow, so a failure
    // upstream arrives here as ?error=. Pass the real reason through rather
    // than reporting the generic no_session it would otherwise produce.
    const upstream = typeof req.query.error === 'string' ? req.query.error : null;
    if (upstream) {
      return res.redirect(`${target}?error=${encodeURIComponent(upstream)}`);
    }

    try {
      const auth = await getAuth();
      const headers = new Headers();
      // The session the provider callback just established lives in this cookie.
      if (req.headers.cookie) headers.set('cookie', req.headers.cookie);

      const result = (await auth.api.generateOneTimeToken({ headers })) as
        | { token?: string }
        | null;

      if (!result?.token) {
        return res.redirect(`${target}?error=no_session`);
      }
      return res.redirect(`${target}?token=${encodeURIComponent(result.token)}`);
    } catch {
      // Always bounce back into the app: stranding someone on a blank API page
      // in a web view gives them nothing to do but force-quit.
      return res.redirect(`${target}?error=handoff_failed`);
    }
  }
}
