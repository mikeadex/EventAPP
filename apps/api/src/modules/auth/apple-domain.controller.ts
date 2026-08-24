import { Controller, Get, Header, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Serves Apple's domain-association file.
 *
 * Sign In with Apple will not accept a return URL until Apple has verified it
 * owns the domain, and it verifies by fetching
 * `/.well-known/apple-developer-domain-association.txt` over plain HTTPS. Our
 * return URL is `https://api.ekklesiaevents.com/auth/callback/apple`, so the
 * file has to be served from this API rather than the web app.
 *
 * The contents come from Apple (Certificates, Identifiers & Profiles → the
 * Services ID → Configure → Download) and are public by design — Apple fetches
 * them unauthenticated. It lives in an environment variable rather than the
 * repo only so that re-verifying does not need a commit and a deploy.
 *
 * Note this route is excluded from the `/v1` global prefix in bootstrap.ts;
 * Apple looks at the domain root and nowhere else.
 */
@Controller('.well-known')
export class AppleDomainController {
  @Get('apple-developer-domain-association.txt')
  @Header('content-type', 'text/plain; charset=utf-8')
  file(@Res() res: Response) {
    const body = process.env.APPLE_DOMAIN_ASSOCIATION?.trim();
    // A 404 is the honest answer when it is unset — an empty 200 would let
    // Apple report a verification failure with no clue as to why.
    if (!body) throw new NotFoundException('Apple domain association is not configured');
    return res.send(body);
  }
}
