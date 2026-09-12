import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { signUp } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/social-sign-in';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [checkYourEmail, setCheckYourEmail] = useState(false);

  async function submit() {
    setPending(true);
    setError(null);
    const res = await signUp.email({ name, email, password });
    setPending(false);
    if (res.error) {
      setError(res.error.message ?? 'Sign-up failed');
      return;
    }
    // Verification is required, so sign-up returns no session. Dropping someone
    // into the tabs here leaves them signed out with nothing explaining why,
    // and no idea an email is waiting for them.
    if (!res.data?.token) {
      setCheckYourEmail(true);
      return;
    }
    router.replace('/(tabs)');
  }

  if (checkYourEmail) {
    return (
      <View style={[styles.c, { justifyContent: 'center' }]}>
        <Text style={styles.h}>Check your email</Text>
        <Text style={styles.m}>
          We&rsquo;ve sent a verification link to {email}. Tap it to finish setting up your
          account, then sign in.
        </Text>
        <Text style={[styles.m, { marginTop: spacing[3] }]}>
          The link lasts 24 hours. If it doesn&rsquo;t arrive, check your spam folder — or try
          signing in, which will offer to send another.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/auth/sign-in')}>
          <Text style={styles.btnText}>Go to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.c}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.h}>Create your account</Text>
      <Text style={styles.m}>Free for attendees. No card required.</Text>

      <TextInput
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />
      <TextInput
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />
      <TextInput
        placeholder="Password (12+ chars)"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        placeholderTextColor={color.ink[300]}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.btn} onPress={submit} disabled={pending}>
        {pending ? (
          <ActivityIndicator color={color.ink[0]} />
        ) : (
          <Text style={styles.btnText}>Create account</Text>
        )}
      </Pressable>

      <SocialSignIn onSignedIn={() => router.replace('/(tabs)')} />

      <View style={{ marginTop: spacing[6], flexDirection: 'row' }}>
        <Text style={styles.muted}>Already have one? </Text>
        <Link href="/auth/sign-in">
          <Text style={styles.link}>Sign in</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[50], padding: spacing[6], justifyContent: 'center' },
  h: { fontSize: fontSize['3xl'], fontWeight: fontWeight.bold, color: color.ink[900] },
  m: { color: color.ink[500], marginTop: spacing[1], marginBottom: spacing[6] },
  input: {
    backgroundColor: color.ink[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink[200],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    marginBottom: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
  },
  error: { color: color.danger, marginBottom: spacing[3], fontSize: fontSize.sm },
  btn: {
    backgroundColor: color.brand[600],
    paddingVertical: spacing[3],
    borderRadius: radius.md,
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  muted: { color: color.ink[500] },
  link: { color: color.brand[600], fontWeight: fontWeight.medium },
});
