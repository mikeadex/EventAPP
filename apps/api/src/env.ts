/**
 * Fail-fast environment validation.
 *
 * Without this, a missing DATABASE_URL surfaces as `PrismaService.onModuleInit`
 * throwing deep inside Nest's DI container — which on Vercel becomes an opaque
 * `FUNCTION_INVOCATION_FAILED` with no indication of what's actually wrong.
 * Checking up front turns that into one obvious log line.
 */

/** Vars the app genuinely cannot boot without. */
const REQUIRED = ['DATABASE_URL', 'BETTER_AUTH_SECRET'] as const;

/**
 * Vars that are safe to omit but change behaviour in ways that are confusing
 * to debug in production (auth callbacks pointing at localhost, CORS silently
 * rejecting the web app).
 */
const RECOMMENDED = ['BETTER_AUTH_URL', 'TRUSTED_ORIGINS', 'WEB_URL'] as const;

export function assertRequiredEnv(): void {
  const missing = REQUIRED.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        `Set them in the Vercel project settings (or apps/api/.env locally) and redeploy. ` +
        `DATABASE_URL must be a Postgres connection string — on serverless use the ` +
        `pooled/PgBouncer URL, not the direct one.`,
    );
  }

  const absent = RECOMMENDED.filter((k) => !process.env[k]);
  if (absent.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Not set: ${absent.join(', ')}. ` +
        `Auth callback URLs and CORS origins will fall back to localhost defaults.`,
    );
  }
}
