import { BadRequestException, Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { getAuth, isTrustedRedirect } from './auth.js';
import { enabledSocialProviders } from './social-providers.js';

/**
 * Starts social sign-in as a top-level navigation, rather than the client
 * POSTing for a URL and then redirecting.
 *
 * That distinction is the whole point. Better Auth sets a `SameSite=Lax` state
 * cookie when the flow begins and checks it on the callback. Web and API live
 * on different sites — `vercel.app` is on the Public Suffix List, so two
 * subdomains of it are cross-site — and a browser will not store a cookie set
 * on a cross-site XHR. The state was silently dropped and every callback came
 * back `state_mismatch`. The native app hit the same wall from the other side:
 * it POSTed itself, so the cookie landed on the app's fetch (which discards
 * cookies by design) and never reached the web view doing the OAuth.
 *
 * Navigating here first makes the API the top-level site, so the state cookie
 * is first-party — set and returned normally, whatever a browser thinks of
 * third-party cookies.
 */
@Controller('social')
export class SocialStartController {
  @Get('start')
  async start(
    @Query('provider') provider: string,
    @Query('redirect') redirect: string,
    @Query('errorRedirect') errorRedirect: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!provider || !enabledSocialProviders().includes(provider as never)) {
      throw new BadRequestException('Unknown or unconfigured provider');
    }
    if (!redirect) throw new BadRequestException('redirect is required');
    // Better Auth only validates callbackURL in its router middleware, which a
    // server-side auth.api.* call does not pass through. Without this check the
    // endpoint would happily bounce people to any site on the internet.
    if (!isTrustedRedirect(redirect)) {
      throw new BadRequestException('redirect is not a trusted origin');
    }
    // Where a *failed* sign-in lands. Without this Better Auth serves its own
    // error page on the API's domain — a dead end on the web, and worse in the
    // native web view, where it strands someone with no route back into the
    // app. Defaulting to `redirect` at least returns them somewhere of ours.
    const onError = errorRedirect ?? redirect;
    if (!isTrustedRedirect(onError)) {
      throw new BadRequestException('errorRedirect is not a trusted origin');
    }

    const auth = await getAuth();
    const headers = new Headers();
    if (req.headers.cookie) headers.set('cookie', req.headers.cookie);

    // Typed structurally: `Response` in this file is Express's, not the fetch
    // one Better Auth returns.
    const response = (await auth.api.signInSocial({
      body: { provider, callbackURL: redirect, errorCallbackURL: onError },
      headers,
      asResponse: true,
    })) as unknown as {
      headers: { getSetCookie?: () => string[] };
      json: () => Promise<{ url?: string }>;
    };

    // Carry Better Auth's state cookie through to the browser — without it the
    // callback has nothing to compare against.
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (setCookie.length) res.setHeader('set-cookie', setCookie);

    const body = (await response.json()) as { url?: string };
    if (!body?.url) throw new BadRequestException('Could not start sign-in');

    return res.redirect(body.url);
  }
}
