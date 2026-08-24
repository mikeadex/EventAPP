import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { fetchSocialProviders, signInWithProvider } from '@/lib/social-auth';
import { showToast } from '@/components/toast';

/**
 * Renders a button per provider this deployment can actually complete, and
 * nothing at all when none are configured — which keeps the sign-in screen
 * unchanged until credentials exist.
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

export function SocialSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [providers, setProviders] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSocialProviders().then((p) => {
      if (!cancelled) setProviders(p);
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
      <View style={styles.dividerRow}>
        <View style={styles.rule} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.rule} />
      </View>

      {providers.map((id) => (
        <Pressable
          key={id}
          disabled={pending !== null}
          onPress={() => void go(id)}
          style={[styles.btn, pending !== null && { opacity: 0.6 }]}
        >
          <Ionicons name={ICONS[id] ?? 'globe-outline'} size={18} color={color.ink[900]} />
          <Text style={styles.btnText}>
            {pending === id ? 'Opening…' : LABELS[id] ?? `Continue with ${id}`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[3], marginTop: spacing[6] },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: color.ink[200] },
  dividerText: { fontSize: fontSize.xs, color: color.ink[400], textTransform: 'uppercase' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
  },
  btnText: { fontSize: fontSize.base, color: color.ink[900], fontWeight: fontWeight.medium },
});
