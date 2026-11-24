import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Divider } from '@/components/gradient';
import { signIn, emailOtp, refreshSession } from '@/lib/auth-client';
import { showToast } from '@/components/toast';

/**
 * Design 12 — the six-digit sign-in code.
 *
 * Reached from "Email me a sign-in code instead" on the sign-in screen, with
 * the address carried in the query so this screen never has to ask for it
 * twice.
 *
 * The code is a sign-in for an account that already exists — the API sets
 * `disableSignUp`, so this cannot mint one. See the `emailOTP()` plugin in
 * `apps/api/src/modules/auth/auth.ts` for why.
 */

const LENGTH = 6;
const RESEND_SECONDS = 60;

export default function EmailCodeScreen() {
  const insets = useSafeAreaInsets();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);
  // Guards the auto-submit below so a sixth digit cannot fire two requests —
  // one from the effect, one from a tap landing at the same moment.
  const submitting = useRef(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const verify = useCallback(
    async (value: string) => {
      if (submitting.current || value.length !== LENGTH || !email) return;
      submitting.current = true;
      setPending(true);
      setError(null);
      Keyboard.dismiss();

      const res = await signIn.emailOtp({ email, otp: value });

      setPending(false);
      submitting.current = false;

      if (res.error) {
        // Deliberately one message for every failure. The server distinguishes
        // "no such code", "wrong code", "expired" and "no such account", and
        // repeating that back would turn this screen into a way to ask whether
        // an address has an account here.
        setError('That code didn’t work. Check it and try again, or send a new one.');
        setCode('');
        inputRef.current?.focus();
        return;
      }

      // `/sign-in/email-otp` is not one of the paths Better Auth refetches the
      // session for, so without this the sign-in succeeds and every gated
      // screen still says "signed out".
      refreshSession();
      router.replace('/(tabs)');
    },
    [email],
  );

  function onChange(next: string) {
    const digits = next.replace(/\D/g, '').slice(0, LENGTH);
    setCode(digits);
    if (error) setError(null);
    // Typing (or autofilling) the last digit is the submit. Making someone
    // reach for a button after the code is already complete is a step that
    // exists only because the form has one.
    if (digits.length === LENGTH) void verify(digits);
  }

  async function resend() {
    if (secondsLeft > 0 || !email) return;
    setSecondsLeft(RESEND_SECONDS);
    setError(null);
    setCode('');
    const res = await emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
    showToast(res.error ? 'Could not send a new code — try again' : 'New code sent');
    inputRef.current?.focus();
  }

  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <View style={styles.topBar}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={theme.dark.textPrimary} />
        </Pressable>
        <Text variant="footnote" tone="onPhotoMuted" style={styles.topTitle}>
          Check your email
        </Text>
        <View style={styles.roundBtn} />
      </View>

      <View style={styles.head}>
        <View style={styles.tile}>
          <Ionicons name="mail-outline" size={27} color={theme.dark.accent} />
        </View>
        <Text variant="title" tone="onPhoto" style={styles.heading}>
          Enter your code
        </Text>
        <Text variant="body" tone="secondary" style={styles.blurb}>
          We sent a six-digit code to {email}
        </Text>
      </View>

      {/* One real field behind six drawn boxes. Six separate inputs is the
          obvious build and the wrong one: it breaks paste, fights the
          backspace key across box boundaries, and iOS will not autofill a
          code into it. */}
      <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: LENGTH }).map((_, i) => {
          const filled = i < code.length;
          const active = i === code.length;
          return (
            <View
              key={i}
              style={[styles.box, filled && styles.boxFilled, active && styles.boxActive]}
            >
              {filled ? (
                <Text variant="mono" style={styles.digit}>
                  {code[i]}
                </Text>
              ) : active ? (
                <View style={styles.caret} />
              ) : null}
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          // What makes iOS offer the code straight from Mail, instead of
          // making someone switch apps and memorise six digits.
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          autoFocus
          maxLength={LENGTH}
          caretHidden
          style={styles.hiddenInput}
        />
      </Pressable>

      <View style={styles.foot}>
        {error ? (
          <Text variant="label" style={styles.error}>
            {error}
          </Text>
        ) : (
          <Pressable
            onPress={() => void resend()}
            disabled={secondsLeft > 0}
            hitSlop={10}
            style={styles.resendRow}
          >
            <Ionicons
              name={secondsLeft > 0 ? 'time-outline' : 'refresh'}
              size={15}
              color={secondsLeft > 0 ? palette.warm[550] : theme.dark.accent}
            />
            <Text variant="footnote" tone={secondsLeft > 0 ? 'secondary' : 'accent'}>
              {secondsLeft > 0 ? `Resend in ${mmss}` : 'Send a new code'}
            </Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => void verify(code)}
          disabled={pending || code.length !== LENGTH}
          style={({ pressed }) => [
            styles.cta,
            (pending || pressed) && { opacity: 0.8 },
            code.length !== LENGTH && styles.ctaDisabled,
          ]}
        >
          {pending ? (
            <ActivityIndicator color={theme.dark.accent} />
          ) : (
            <Text variant="bodyLg" style={styles.ctaText}>
              Verify and continue
            </Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.legal, { paddingBottom: insets.bottom + 30 }]}>
        <Divider inset={0.15} opacity={0.2} />
        <Text variant="label" tone="secondary" style={styles.legalText}>
          Codes expire after ten minutes.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { letterSpacing: 2.1, textTransform: 'uppercase' },

  head: { paddingHorizontal: 24, paddingTop: 48, alignItems: 'center', gap: 12 },
  tile: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(249,142,128,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { fontSize: 28, lineHeight: 32, paddingTop: 8 },
  blurb: { maxWidth: 280, textAlign: 'center' },

  boxes: { flexDirection: 'row', gap: 9, paddingHorizontal: 24, paddingTop: 40 },
  box: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: theme.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxFilled: { borderColor: 'rgba(249,142,128,0.45)' },
  boxActive: { borderColor: 'rgba(249,142,128,0.7)' },
  digit: { fontSize: 24, lineHeight: 30, letterSpacing: 0, color: theme.dark.textPrimary },
  caret: { width: 2, height: 24, backgroundColor: theme.dark.accent },
  /**
   * Transparent and stretched across the boxes rather than moved off-screen.
   * An input at a negative offset loses the iOS autofill chip, which is the
   * whole reason the field is real.
   */
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    color: 'transparent',
  },

  foot: { paddingHorizontal: 24, paddingTop: 26, alignItems: 'center', gap: 16 },
  resendRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 4 },
  error: { color: '#D9A9A2', textAlign: 'center' },
  cta: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 17,
    borderRadius: radius.full,
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.55)',
  },
  ctaDisabled: { backgroundColor: 'transparent', borderColor: theme.dark.border },
  ctaText: { color: palette.coral[200] },

  legal: { marginTop: 'auto', paddingHorizontal: 24, gap: 10 },
  legalText: { textAlign: 'center' },
});
