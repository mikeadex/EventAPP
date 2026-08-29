import { PrismaClient } from '@prisma/client';
import { useDeadConnectionRetry } from '../../prisma/db-retry.js';
import { EmailService } from '../email/email.service.js';
import { passwordResetEmail } from '../email/templates/password-reset.js';
import { verifyEmailTemplate } from '../email/templates/verify-email.js';
import { buildSocialProviders } from './social-providers.js';

/**
 * better-auth is published as pure ESM: `"type": "module"`, a single
 * `dist/index.mjs`, and no `require` condition in its exports map. This API
 * compiles to CommonJS, so a static import becomes `require()` of an ES module
 * — which Vercel's runtime rejects with ERR_REQUIRE_ESM. (It happens to work on
 * Node >= 22.12 locally, which is why this only ever failed in production.)
 *
 * The real dynamic imports live in `lib/load-esm.js`, outside `src/` so `tsc`
 * cannot rewrite them and with literal specifiers so Vercel's file tracer still
 * bundles the package. See that file for the full reasoning.
 */
import {
  loadBetterAuth,
  loadBetterAuthPlugins,
  loadBetterAuthPrismaAdapter,
} from '../../../lib/load-esm.js';

/**
 * Inferred from `createAuth` rather than written as
 * `ReturnType<typeof betterAuth>`: betterAuth is generic over the options it's
 * given, so the concrete instance is not assignable to the default
 * `Auth<BetterAuthOptions>` instantiation.
 */
type AuthInstance = Awaited<ReturnType<typeof createAuth>>;

// Singleton client for Better Auth (separate from Nest's PrismaService is fine —
// Better Auth manages its own connection lifecycle for the handler).
const prisma = new PrismaClient();
// This client is on the sign-in path, so a stale pooled connection surfaces as a
// failed login rather than a failed list — same fix as PrismaService.
useDeadConnectionRetry(prisma);

// EmailService only reads env (no Nest-injected deps), so it's safe to construct
// directly here — Better Auth's config is a plain module singleton, not a Nest
// provider, so it can't resolve EmailService through DI.
const emailService = new EmailService();

const RESET_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
const VERIFY_TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day — signing up is not always finished at a desk

// Origins the API will accept auth requests from. Includes the mobile deep-link
// scheme so the native app's bearer-token flow is trusted.
// Read lazily rather than at module load: on Vercel this module is imported
// during the build, when the env is not yet the runtime env.
export function trustedOriginList(): string[] {
  return [
    ...(process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
    process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
    `${process.env.MOBILE_DEEPLINK_SCHEME ?? 'ekklesia'}://`,
  ];
}

/**
 * Whether a post-sign-in redirect target is one of ours.
 *
 * Better Auth applies this check as *router* middleware, so it only runs for
 * requests that go through auth.handler. Calling auth.api.* server-side skips
 * it — which would leave social-start.controller.ts an open redirect. Hence
 * the same check, applied by hand at that call site.
 */
export function isTrustedRedirect(url: string): boolean {
  const origins = trustedOriginList();
  if (origins.some((o) => o.endsWith('://') && url.startsWith(o))) return true;
  try {
    const target = new URL(url);
    return origins.some((o) => {
      try {
        return new URL(o).origin === target.origin;
      } catch {
        return false;
      }
    });
  } catch {
    // Not absolute — a bare path can only mean this API's own origin. But
    // "//evil.example.com" is a *protocol-relative* URL that browsers resolve
    // to another host, so only a single leading slash counts as a path.
    return url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
  }
}

// HTTPS-only cookies, and the gate for SameSite=None below.
const secureCookies = process.env.NODE_ENV === 'production';

let cached: Promise<AuthInstance> | null = null;

/**
 * Resolve the Better Auth instance, constructing it on first use.
 *
 * Both call sites (the /auth/* handler controller and CurrentUserService) are
 * already async, so awaiting here costs nothing. The promise is cached rather
 * than the resolved value so concurrent first requests share one construction.
 */
export function getAuth(): Promise<AuthInstance> {
  if (!cached) cached = createAuth();
  return cached;
}

async function createAuth() {
  const [{ betterAuth }, { prismaAdapter }, { bearer, oneTimeToken }] = await Promise.all([
    loadBetterAuth(),
    loadBetterAuthPrismaAdapter(),
    loadBetterAuthPlugins(),
  ]);

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
    basePath: '/auth', // routes live at /auth/* (not the default /api/auth/*)
    trustedOrigins: trustedOriginList(),
    // The bearer plugin lets native clients authenticate with
    // `Authorization: Bearer <session-token>` instead of cookies. On sign-in the
    // server returns the token in a `set-auth-token` response header; the mobile
    // app persists it in SecureStore and replays it, so login survives restarts.
    // (Web continues to use cookies — bearer is purely additive.)
    plugins: [
      bearer(),
      // Used only to hand a web-view session to the native app after social
      // sign-in; see native-handoff.controller.ts. Short-lived and single-use.
      oneTimeToken({ expiresIn: 3 }),
    ],
    // Only providers whose credentials are present; see social-providers.ts.
    socialProviders: buildSocialProviders(),
    // Verification applies to email/password signups only. Google and Apple
    // assert the address themselves, and Better Auth marks those verified on
    // the provider's word — so a social sign-in is never asked to confirm.
    //
    // Accounts predating this were backfilled to emailVerified = true by
    // migration, rather than being locked out of an app they already use.
    emailVerification: {
      sendOnSignUp: true,
      // Straight into the app once confirmed, rather than stopping on a page
      // that only says "verified" and leaves them to find their way back.
      autoSignInAfterVerification: true,
      expiresIn: VERIFY_TOKEN_TTL_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        const { subject, html, text } = verifyEmailTemplate({
          url,
          name: user.name,
          expiresInLabel: '24 hours',
        });
        await emailService.send({
          to: user.email,
          subject,
          html,
          text,
          tags: [{ name: 'type', value: 'verify-email' }],
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: RESET_TOKEN_TTL_SECONDS,
      // Sends the reset link. `url` already encodes the token and the client's
      // redirectTo (the mobile app passes `ekklesia://auth/reset-password`, so the
      // link deep-links back into the app after the token is verified).
      sendResetPassword: async ({ user, url }) => {
        const { subject, html, text } = passwordResetEmail({
          url,
          name: user.name,
          expiresInLabel: '1 hour',
        });
        await emailService.send({
          to: user.email,
          subject,
          html,
          text,
          tags: [{ name: 'type', value: 'password-reset' }],
        });
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh sliding window daily
    },
    advanced: {
      crossSubDomainCookies: { enabled: false },
      useSecureCookies: secureCookies,
      // Left at Better Auth's SameSite=Lax default, which is only correct
      // because the web app and this API now share a registrable domain
      // (ekklesiaevents.com and api.ekklesiaevents.com), making the session
      // cookie first-party.
      //
      // It briefly had to be SameSite=None: on the old *.vercel.app pair the
      // two were different *sites* — vercel.app is on the Public Suffix List —
      // so the browser stored the session at the OAuth callback and then
      // refused to send it on any of the web app's XHRs. Sign-in looked like it
      // worked and the app still saw no user. If web and API are ever split
      // across unrelated domains again, that is the symptom and None is the
      // workaround — but it makes the session a third-party cookie, which
      // Safari blocks outright, so a shared domain is the real answer.
    },
  });
}
