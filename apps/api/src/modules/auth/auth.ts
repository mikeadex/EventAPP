import { PrismaClient } from '@prisma/client';
import { useDeadConnectionRetry } from '../../prisma/db-retry.js';
import { EmailService } from '../email/email.service.js';
import { passwordResetEmail } from '../email/templates/password-reset.js';

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

// Origins the API will accept auth requests from. Includes the mobile deep-link
// scheme so the native app's bearer-token flow is trusted.
const trustedOrigins = [
  ...(process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
  `${process.env.MOBILE_DEEPLINK_SCHEME ?? 'ekklesia'}://`,
];

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
  const [{ betterAuth }, { prismaAdapter }, { bearer }] = await Promise.all([
    loadBetterAuth(),
    loadBetterAuthPrismaAdapter(),
    loadBetterAuthPlugins(),
  ]);

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:4000',
    basePath: '/auth', // routes live at /auth/* (not the default /api/auth/*)
    trustedOrigins,
    // The bearer plugin lets native clients authenticate with
    // `Authorization: Bearer <session-token>` instead of cookies. On sign-in the
    // server returns the token in a `set-auth-token` response header; the mobile
    // app persists it in SecureStore and replays it, so login survives restarts.
    // (Web continues to use cookies — bearer is purely additive.)
    plugins: [bearer()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // flip on once email provider is wired
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
      useSecureCookies: process.env.NODE_ENV === 'production',
    },
  });
}
