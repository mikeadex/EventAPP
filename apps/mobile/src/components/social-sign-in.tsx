import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { fetchSocialProviders, signInWithProvider } from '@/lib/social-auth';
import { showToast } from '@/components/toast';
import { Text } from '@/components/text';
import { Gradient } from '@/components/gradient';

/**
 * Renders a button per provider this deployment can actually complete, and
 * nothing at all when none are configured — which keeps the sign-in screen
 * unchanged until credentials exist.
 *
 * The handoff puts these *above* the email form, not under it, and that is a
 * hierarchy decision rather than a layout one: most people arriving here have
 * a Google or Apple account and no password with us, so the fastest route in
 * belongs at the top. Screens therefore render this first and the form after
 * the divider it draws.
 */
const LABELS: Record<string, string> = {
  google: 'Continue with Google',
  apple: 'Continue with Apple',
  microsoft: 'Continue with Microsoft',
};

/** Better Auth's codes are terse; say something a person can act on. */
const ERRORS: Record<string, string> = {
  please_restart_the_process: 'That took too long — please try again',
  invalid_code: "Couldn't complete sign-in — please try again",
  no_session: "Couldn't complete sign-in — please try again",
  handoff_failed: "Couldn't complete sign-in — please try again",
  account_not_linked: 'That email already has an account. Sign in with your password first.',
};

const ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  google: 'logo-google',
  apple: 'logo-apple',
  microsoft: 'logo-microsoft',
};

/**
 * Apple leads on iOS, where it is the native sheet and Face ID rather than a
 * web view, and where App Review expects to see it offered at least as
 * prominently as any other provider. Elsewhere it is the one going through a
 * browser, so it does not lead.
 */
function ordered(providers: string[]): string[] {
  const first = Platform.OS === 'ios' ? 'apple' : 'google';
  return [...providers].sort((a, b) => Number(b === first) - Number(a === first));
}

export function SocialSignIn({
  onSignedIn,
  /** The "or" rule under the buttons. Off for a screen that has no form. */
  divider = true,
}: {
  onSignedIn: () => void;
  divider?: boolean;
}) {
  const [providers, setProviders] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSocialProviders().then((p) => {
      if (!cancelled) setProviders(ordered(p));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (providers.length === 0) return null;

  async function go(provider: string) {
    setPending(provider);
    const res = await signInWithProvider(provider);
    setPending(null);

    if (res.ok) {
      onSignedIn();
      return;
    }
    if (res.reason === 'cancelled') return; // they backed out; nothing to say
    if (res.reason === 'unsupported') {
      showToast('Update the app to sign in this way');
      return;
    }
    showToast(
      (res.message && ERRORS[res.message]) ?? res.message ?? "Couldn't sign in — try again",
    );
  }

  return (
    <View style={styles.wrap}>
      {providers.map((id, i) => {
        // The first provider is the filled one. The handoff draws exactly one
        // solid button per screen — making both solid would leave nothing
        // saying which is the ordinary way in.
        const solid = i === 0;
        const fg = solid ? theme.dark.backgroundDeep : theme.dark.textPrimary;
        return (
          <Pressable
            key={id}
            disabled={pending !== null}
            onPress={() => void go(id)}
            accessibilityRole="button"
            accessibilityLabel={LABELS[id] ?? `Continue with ${id}`}
            style={({ pressed }) => [
              styles.btn,
              solid ? styles.btnSolid : styles.btnOutline,
              (pending !== null || pressed) && { opacity: 0.72 },
            ]}
          >
            <Ionicons
              name={ICONS[id] ?? 'globe-outline'}
              size={19}
              // Coral on the outlined buttons, matching the handoff: a white
              // glyph there reads as a second primary action.
              color={solid ? fg : theme.dark.accent}
            />
            <Text variant="bodyLg" style={{ color: fg }}>
              {pending === id ? 'Opening…' : (LABELS[id] ?? `Continue with ${id}`)}
            </Text>
          </Pressable>
        );
      })}

      {divider ? (
        <View style={styles.dividerRow}>
          {/* Each rule fades toward the screen edge and holds its weight
              beside the word, so the eye is carried inward to "or" rather
              than out to the margins. */}
          <View style={styles.rule}>
            <Gradient
              angle={90}
              color="#F98E80"
              stops={[
                { at: 0, opacity: 0 },
                { at: 0.4, opacity: 0.22 },
                { at: 1, opacity: 0.22 },
              ]}
            />
          </View>
          <Text variant="caption" style={styles.dividerText}>
            or
          </Text>
          <View style={styles.rule}>
            <Gradient
              angle={90}
              color="#F98E80"
              stops={[
                { at: 0, opacity: 0.22 },
                { at: 0.6, opacity: 0.22 },
                { at: 1, opacity: 0 },
              ]}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3] },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: spacing[2] },
  rule: { flex: 1, height: 1 },
  dividerText: {
    letterSpacing: 2.16,
    color: palette.warm[550],
    textTransform: 'uppercase',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
    borderRadius: radius.full,
    paddingVertical: 16,
  },
  /** The near-white fill the handoff gives the leading provider. */
  btnSolid: { backgroundColor: palette.warm[50] },
  btnOutline: {
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.16)',
  },
});
