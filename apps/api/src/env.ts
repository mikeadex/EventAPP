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

/**
 * Fail if `name` is set to something that isn't an http(s) URL.
 *
 * Never echoes the value: the whole reason this check exists is that a secret
 * was pasted into a URL variable, and better-auth's own error printed it in
 * full to the logs.
 */
function assertLooksLikeUrl(name: string): void {
  const value = process.env[name];
  if (!value) return; // absence is handled separately
  let ok = false;
  try {
    ok = /^https?:$/.test(new URL(value).protocol);
  } catch {
    ok = false;
  }
  if (!ok) {
    throw new Error(
      `${name} is set but is not a valid http(s) URL (got ${value.length} characters). ` +
        `It should look like https://your-api.vercel.app — check you haven't pasted a ` +
        `secret or connection string into it.`,
    );
  }
}

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

  // Presence is not enough: pasting the wrong value into the right variable is
  // just as fatal and much harder to spot. A secret landing in BETTER_AUTH_URL
  // surfaced only as "Invalid base URL: <secret>" from deep inside better-auth,
  // at request time rather than startup — and leaked the secret into the logs.
  assertLooksLikeUrl('BETTER_AUTH_URL');
  assertLooksLikeUrl('WEB_URL');

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!/^postgres(ql)?:\/\//.test(dbUrl)) {
    throw new Error(
      'DATABASE_URL must be a Postgres connection string starting with postgresql:// or postgres://. ' +
        'Check the value set in the Vercel project settings.',
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
