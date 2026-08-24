/**
 * Social sign-in providers, each switched on only when its credentials are
 * present. A provider with no credentials is left out entirely rather than
 * registered half-configured, so `/auth/sign-in/social` returns a clean error
 * instead of redirecting people to a broken consent screen.
 *
 * Clients ask which are live via GET /v1/auth/providers, so a button only
 * appears once the environment can actually complete the flow. That keeps a
 * missing secret from looking like a broken app.
 */
export const SOCIAL_PROVIDER_IDS = ['google', 'apple', 'microsoft'] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

function credential(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Apple is the fiddly one: the "client secret" is a short-lived JWT signed with
 * a .p8 key rather than a static string. Better Auth will build it when given
 * the key material, so the private key is passed through as-is. Newlines
 * survive an environment variable badly, so `\n` escapes are restored.
 */
function applePrivateKey(): string | undefined {
  const raw = credential('APPLE_PRIVATE_KEY');
  return raw?.replace(/\\n/g, '\n');
}

export function buildSocialProviders(): Record<string, unknown> {
  const providers: Record<string, unknown> = {};

  const googleId = credential('GOOGLE_CLIENT_ID');
  const googleSecret = credential('GOOGLE_CLIENT_SECRET');
  if (googleId && googleSecret) {
    providers.google = { clientId: googleId, clientSecret: googleSecret };
  }

  const appleId = credential('APPLE_CLIENT_ID');
  const appleTeamId = credential('APPLE_TEAM_ID');
  const appleKeyId = credential('APPLE_KEY_ID');
  const appleKey = applePrivateKey();
  if (appleId && appleTeamId && appleKeyId && appleKey) {
    providers.apple = {
      clientId: appleId,
      appBundleIdentifier: credential('APPLE_BUNDLE_ID'),
      teamId: appleTeamId,
      keyId: appleKeyId,
      privateKey: appleKey,
    };
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

/** Which providers a client should offer a button for. */
export function enabledSocialProviders(): SocialProviderId[] {
  const configured = buildSocialProviders();
  return SOCIAL_PROVIDER_IDS.filter((id) => id in configured);
}
