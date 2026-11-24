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

/**
 * Stripe key checks.
 *
 * Shape only — never the value. A prefix is not a secret (every Stripe key
 * starts with one of six known strings), but the rest of the key is, so the
 * messages below report a length and a prefix and nothing more.
 *
 * The case worth failing hard on is a mode mismatch: a live secret paired with
 * a test publishable key, or the reverse. Stripe does not reject it at the
 * wrong end — the client tokenises against one account and the server confirms
 * against another, so it surfaces as "No such payment_intent" on a real card,
 * in production, after someone has been charged nothing but thinks they have.
 */
function stripeMode(value: string | undefined): 'test' | 'live' | null {
  if (!value) return null;
  if (/^(sk|pk|rk)_test_/.test(value)) return 'test';
  if (/^(sk|pk|rk)_live_/.test(value)) return 'live';
  return null;
}

/**
 * The publishable key is carried under a framework-prefixed name so the client
 * bundlers inline it. Both live in the same `.env`, so both are visible here
 * and both are worth checking — the leak this guards against is the same
 * either way.
 */
const PUBLISHABLE_KEY_VARS = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_PUBLISHABLE_KEY',
] as const;

/** Unreplaced scaffolding (`sk_test_replace_me`) is the same as unset. */
function realValue(name: string): string | undefined {
  const v = process.env[name];
  if (!v || /replace|your[_-]?key|xxx|placeholder|changeme/i.test(v)) return undefined;
  return v;
}

function assertStripeEnv(): void {
  const secret = realValue('STRIPE_SECRET_KEY');
  const publishableVar = PUBLISHABLE_KEY_VARS.find((n) => realValue(n));
  const publishable = publishableVar ? realValue(publishableVar) : undefined;
  const webhook = realValue('STRIPE_WEBHOOK_SECRET');

  // Payments are optional until an organiser actually sells something, so an
  // unset key is a warning rather than a boot failure.
  if (!secret && !publishable) {
    // eslint-disable-next-line no-console
    console.warn(
      '[env] Stripe keys not set (STRIPE_SECRET_KEY / *_STRIPE_PUBLISHABLE_KEY). ' +
        'Paid tickets and donations will be refused; free RSVP is unaffected.',
    );
    return;
  }

  if (secret && !/^(sk|rk)_(test|live)_/.test(secret)) {
    throw new Error(
      `STRIPE_SECRET_KEY does not look like a Stripe secret key (got ${secret.length} ` +
        `characters starting "${secret.slice(0, 3)}"). It should start sk_test_ or sk_live_.`,
    );
  }

  // The dangerous direction: a secret key pasted into the publishable variable
  // is published to every phone and browser that asks for it.
  if (publishable && /^(sk|rk)_/.test(publishable)) {
    throw new Error(
      `${publishableVar} holds a SECRET key (it starts sk_ or rk_). That variable is ` +
        `inlined into the app bundle and served to every client. Roll that key in the ` +
        `Stripe dashboard now, then set the publishable key, which starts pk_.`,
    );
  }

  if (publishable && !/^pk_(test|live)_/.test(publishable)) {
    throw new Error(
      `${publishableVar} does not look like a Stripe publishable key (got ` +
        `${publishable.length} characters starting "${publishable.slice(0, 3)}"). ` +
        `It should start pk_test_ or pk_live_.`,
    );
  }

  const secretMode = stripeMode(secret);
  const publishableMode = stripeMode(publishable);
  if (secretMode && publishableMode && secretMode !== publishableMode) {
    throw new Error(
      `Stripe keys are from different modes: the secret key is ${secretMode} and the ` +
        `publishable key is ${publishableMode}. They must be the same mode or payments ` +
        `fail only once a real card is used.`,
    );
  }

  if (secretMode === 'live' && process.env.NODE_ENV !== 'production') {
    throw new Error(
      'STRIPE_SECRET_KEY is a LIVE key but NODE_ENV is not "production". ' +
        'Use test keys outside production — live keys move real money.',
    );
  }

  if (secret && !webhook) {
    // eslint-disable-next-line no-console
    console.warn(
      '[env] STRIPE_WEBHOOK_SECRET not set. Stripe webhooks will be rejected, so orders ' +
        'will stay PENDING even after a successful payment.',
    );
  } else if (webhook && !webhook.startsWith('whsec_')) {
    throw new Error(
      `STRIPE_WEBHOOK_SECRET does not look like a Stripe signing secret (got ` +
        `${webhook.length} characters). It should start whsec_.`,
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

  assertStripeEnv();

  const absent = RECOMMENDED.filter((k) => !process.env[k]);
  if (absent.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[env] Not set: ${absent.join(', ')}. ` +
        `Auth callback URLs and CORS origins will fall back to localhost defaults.`,
    );
  }
}
