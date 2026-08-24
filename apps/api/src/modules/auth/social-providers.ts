import { sign as cryptoSign } from 'node:crypto';

/**
 * Social sign-in providers, each switched on only when its credentials are
 * present. A provider with no credentials is left out entirely rather than
 * registered half-configured, so `/auth/sign-in/social` returns a clean error
 * instead of redirecting people to a broken consent screen.
 *
 * Clients ask which are live via GET /v1/config, so a button only appears once
 * the environment can actually complete the flow. That keeps a missing secret
 * from looking like a broken app.
 */
export const SOCIAL_PROVIDER_IDS = ['google', 'apple', 'microsoft'] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

function credential(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Put a PEM back into the shape OpenSSL will accept.
 *
 * The .p8 is pasted into a hosting dashboard by hand, and its newlines rarely
 * survive intact: they arrive as literal `\n`, as CRLF, or stripped altogether.
 * Only the last of those actually breaks — Node reads CRLF fine — but it breaks
 * with `DECODER routines::unsupported`, which says nothing about newlines and
 * sends you hunting the wrong problem. Cheaper to normalise all three.
 */
function normalizePem(raw: string): string {
  const text = raw
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim()
    // Pasting a value with its surrounding quotes is easy to do and impossible
    // to see in a dashboard field that renders the value as dots.
    .replace(/^["']|["']$/g, '')
    .trim();

  // Rebuilt unconditionally rather than only when newlines are missing. The
  // damage is rarely all-or-nothing: armour lines survive while the body gets
  // space-separated, or the wrap lands at the wrong width. Taking the base64
  // body and re-wrapping it at 64 characters is correct for an intact key too,
  // so there is no case worth detecting.
  const match = /-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END \1-----/.exec(text);
  if (!match) return text;
  const label = match[1]!;
  const wrapped = match[2]!.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN ${label}-----\n${wrapped}\n-----END ${label}-----\n`;
}

/**
 * Apple's client secret, which is not a secret you are given but a short-lived
 * ES256 JWT you mint yourself, signed with the .p8 key.
 *
 * Better Auth does not build this. `AppleOptions` at 1.6.11 accepts only
 * `clientId`, `appBundleIdentifier` and `audience`, and inherits a *required*
 * `clientSecret` — pass it a team id and private key and it silently ignores
 * them, then rejects the sign-in with CLIENT_ID_AND_SECRET_REQUIRED. That
 * surfaced as a 500 on `/v1/social/start?provider=apple` while Google was fine.
 *
 * Signed with `dsaEncoding: 'ieee-p1363'` because JWS wants the raw r||s pair;
 * Node's default DER encoding produces a token Apple rejects.
 */
const APPLE_SECRET_TTL_SECONDS = 180 * 24 * 60 * 60; // Apple's ceiling is ~6 months

function appleClientSecret(opts: {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
}): string {
  const b64 = (b: string | Buffer) => Buffer.from(b).toString('base64url');
  const now = Math.floor(Date.now() / 1000);

  const header = b64(JSON.stringify({ alg: 'ES256', kid: opts.keyId }));
  const payload = b64(
    JSON.stringify({
      iss: opts.teamId,
      iat: now,
      exp: now + APPLE_SECRET_TTL_SECONDS,
      aud: 'https://appleid.apple.com',
      sub: opts.clientId,
    }),
  );

  const input = `${header}.${payload}`;
  const signature = cryptoSign('sha256', Buffer.from(input), {
    key: opts.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${input}.${b64(signature)}`;
}

function build(): Record<string, unknown> {
  const providers: Record<string, unknown> = {};

  const googleId = credential('GOOGLE_CLIENT_ID');
  const googleSecret = credential('GOOGLE_CLIENT_SECRET');
  if (googleId && googleSecret) {
    providers.google = { clientId: googleId, clientSecret: googleSecret };
  }

  const appleId = credential('APPLE_CLIENT_ID');
  const appleTeamId = credential('APPLE_TEAM_ID');
  const appleKeyId = credential('APPLE_KEY_ID');
  const appleKey = credential('APPLE_PRIVATE_KEY');
  if (appleId && appleTeamId && appleKeyId && appleKey) {
    try {
      providers.apple = {
        clientId: appleId,
        clientSecret: appleClientSecret({
          clientId: appleId,
          teamId: appleTeamId,
          keyId: appleKeyId,
          privateKey: normalizePem(appleKey),
        }),
        // Used as the token audience for the native flow, where the ID token is
        // issued to the app rather than to the Services ID.
        appBundleIdentifier: credential('APPLE_BUNDLE_ID'),
      };
    } catch (e) {
      // Deliberately not fatal. Signing runs while the auth instance is being
      // built, so throwing here would take email and Google sign-in down too —
      // a bad Apple key should cost you the Apple button, nothing else.
      // The message only; never the key, not even its length.
      console.error(
        '[auth] Apple sign-in disabled: could not sign the client secret —',
        e instanceof Error ? e.message : 'unknown error',
      );
    }
  }

  // Outlook / Microsoft 365 accounts. "common" lets both work and personal
  // accounts sign in; a single-tenant app would set its own tenant id.
  const msId = credential('MICROSOFT_CLIENT_ID');
  const msSecret = credential('MICROSOFT_CLIENT_SECRET');
  if (msId && msSecret) {
    providers.microsoft = {
      clientId: msId,
      clientSecret: msSecret,
      tenantId: credential('MICROSOFT_TENANT_ID') ?? 'common',
    };
  }

  return providers;
}

/**
 * Built once per process. Apple's secret costs a signature, and
 * `enabledSocialProviders()` runs on every /v1/config request, so rebuilding
 * each time would re-sign on a hot path for no reason.
 *
 * Caching also keeps the two exports honest with each other: a provider whose
 * credentials are present but unusable is missing from both, so no client is
 * ever offered a button that cannot complete. Env changes need a restart, which
 * on Vercel is what a redeploy already is.
 */
let cached: Record<string, unknown> | null = null;

export function buildSocialProviders(): Record<string, unknown> {
  if (!cached) cached = build();
  return cached;
}

/** Which providers a client should offer a button for. */
export function enabledSocialProviders(): SocialProviderId[] {
  const configured = buildSocialProviders();
  return SOCIAL_PROVIDER_IDS.filter((id) => id in configured);
}
