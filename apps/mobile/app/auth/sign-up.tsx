import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { router, Link } from 'expo-router';
import { spacing, theme } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { authStyles } from '@/components/auth-styles';
import { signUp } from '@/lib/auth-client';
import { SocialSignIn } from '@/components/social-sign-in';
import { PasswordInput } from '@/components/password-input';
import { Logo } from '@/components/logo';

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
      <View style={[authStyles.c, { justifyContent: 'center' }]}>
        <Text variant="display" tone="onPhoto" style={authStyles.h}>
          Check your email
        </Text>
        <Text variant="bodyLg" tone="secondary" style={authStyles.m}>
          We&rsquo;ve sent a verification link to {email}. Tap it to finish setting up your account,
          then sign in.
        </Text>
        <Text style={[authStyles.m, { marginTop: spacing[3] }]}>
          The link lasts 24 hours. If it doesn&rsquo;t arrive, check your spam folder — or try
          signing in, which will offer to send another.
        </Text>
        <Pressable style={authStyles.btn} onPress={() => router.replace('/auth/sign-in')}>
          <Text variant="bodyLg" style={authStyles.btnText}>
            Go to sign in
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={authStyles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={authStyles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Logo size={44} style={authStyles.logo} />
        <Text variant="display" tone="onPhoto" style={authStyles.h}>
          Create your account
        </Text>
        <Text variant="bodyLg" tone="secondary" style={authStyles.m}>
          Free for attendees. No card required.
        </Text>

        {/* A social account is three taps and no password to invent, so it
          belongs ahead of the form here even more than on sign-in. */}
        <SocialSignIn onSignedIn={() => router.replace('/(tabs)')} />

        <TextInput
          placeholder="Name"
          textContentType="name"
          autoComplete="name"
          value={name}
          onChangeText={setName}
          style={authStyles.input}
          placeholderTextColor={theme.dark.textMuted}
        />
        <TextInput
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="username"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          style={authStyles.input}
          placeholderTextColor={theme.dark.textMuted}
        />
        <PasswordInput
          placeholder="Password (12+ chars)"
          purpose="new"
          value={password}
          onChangeText={setPassword}
        />

        {error && (
          <Text variant="label" style={authStyles.error}>
            {error}
          </Text>
        )}

        <Pressable style={authStyles.btn} onPress={submit} disabled={pending}>
          {pending ? (
            <ActivityIndicator color={theme.dark.accent} />
          ) : (
            <Text variant="bodyLg" style={authStyles.btnText}>
              Create account
            </Text>
          )}
        </Pressable>

        <View style={{ marginTop: spacing[6], flexDirection: 'row' }}>
          <Text variant="label" style={authStyles.muted}>
            Already have one?{' '}
          </Text>
          <Link href="/auth/sign-in">
            <Text variant="label" style={authStyles.link}>
              Sign in
            </Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
