import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api, ApiError } from '@/lib/api';
import { showToast } from '@/components/toast';

const COUNTRIES = ['GB', 'IE', 'US'] as const;
const CURRENCY_FOR: Record<(typeof COUNTRIES)[number], string> = {
  GB: 'GBP',
  IE: 'EUR',
  US: 'USD',
};

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

/** Mirrors the server's rule: lowercase, hyphens, no leading or trailing dash. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Local rather than `slugify` from @ekklesia/shared: Metro resolves that
 * package to its TypeScript source, whose `export * from './slug.js'` has no
 * matching file, so importing it red-screens the app. This only suggests an
 * address — the server validates the real thing.
 */
function toSlug(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export default function NewChurchScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>('GB');
  const [shortDescription, setShortDescription] = useState('');
  const [pending, setPending] = useState(false);

  // The address follows the name until it is edited by hand, after which it is
  // left alone — renaming shouldn't silently change a link already shared.
  function onNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(toSlug(v));
  }

  const slugProblem =
    slug.length > 0 && (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug))
      ? 'Use lowercase letters, numbers and hyphens.'
      : null;

  const canSubmit = name.trim().length >= 2 && slug.length >= 3 && !slugProblem && !pending;

  async function create() {
    if (!canSubmit) return;
    setPending(true);
    try {
      const org = await api<{ id: string }>('/v1/organizations', {
        method: 'POST',
        body: {
          name: name.trim(),
          slug,
          kind: 'church',
          country,
          currency: CURRENCY_FOR[country],
          shortDescription: shortDescription.trim() || undefined,
        },
      });
      showToast('Your church is set up', 'checkmark-circle');
      router.replace(`/organizer/${org.id}`);
    } catch (e) {
      // A taken address is the one failure a host can fix themselves, so say so
      // against the field rather than as a generic error.
      if (e instanceof ApiError && e.status === 409) {
        showToast('That address is taken — try another');
      } else {
        showToast(e instanceof Error ? e.message : "Couldn't create your church");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.c, { paddingTop: insets.top + spacing[2] }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={color.ink[900]} />
        </Pressable>
        <Text style={styles.h}>Host events</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: insets.bottom + spacing[10],
          gap: spacing[5],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Set up your church or ministry once, then publish events, sell tickets and check people
          in at the door — all from here.
        </Text>

        <View>
          <Text style={styles.label}>Church or ministry name</Text>
          <TextInput
            value={name}
            onChangeText={onNameChange}
            placeholder="Grace Community Church"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
            editable={!pending}
            maxLength={120}
          />
        </View>

        <View>
          <Text style={styles.label}>Page address</Text>
          <Text style={styles.hint}>
            {WEB_URL ? `${WEB_URL.replace(/^https?:\/\//, '')}/` : 'ekklesia.app/'}
            {slug || 'your-church'}
          </Text>
          <TextInput
            value={slug}
            onChangeText={(v) => {
              setSlugEdited(true);
              setSlug(v.toLowerCase().replace(/\s+/g, '-'));
            }}
            placeholder="grace-community-church"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
            editable={!pending}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={60}
          />
          {slugProblem ? <Text style={styles.error}>{slugProblem}</Text> : null}
        </View>

        <View>
          <Text style={styles.label}>Country</Text>
          <Text style={styles.hint}>Sets your default currency ({CURRENCY_FOR[country]}).</Text>
          <View style={styles.chips}>
            {COUNTRIES.map((c) => {
              const on = country === c;
              return (
                <Pressable
                  key={c}
                  disabled={pending}
                  onPress={() => setCountry(c)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={styles.label}>One-line description</Text>
          <Text style={styles.hint}>Optional. Shown on your church page.</Text>
          <TextInput
            value={shortDescription}
            onChangeText={setShortDescription}
            placeholder="A family church in the heart of Leeds"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
            editable={!pending}
            maxLength={280}
          />
        </View>

        <Pressable
          style={[styles.primaryBtn, !canSubmit && { opacity: 0.5 }]}
          disabled={!canSubmit}
          onPress={() => void create()}
        >
          <Text style={styles.primaryBtnText}>{pending ? 'Setting up…' : 'Create'}</Text>
        </Pressable>

        <Text style={styles.footnote}>
          You&apos;ll be the owner and can add your team later.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink[900] },
  intro: { fontSize: fontSize.base, color: color.ink[600], lineHeight: 22 },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink[900] },
  hint: { fontSize: fontSize.xs, color: color.ink[500], marginTop: 2 },
  error: { fontSize: fontSize.xs, color: color.ink[900], marginTop: spacing[2] },
  input: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
  },
  chips: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  chip: {
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  chipOn: { backgroundColor: color.ink[900], borderColor: color.ink[900] },
  chipText: { fontSize: fontSize.sm, color: color.ink[700] },
  chipTextOn: { color: color.ink[0] },
  primaryBtn: {
    backgroundColor: color.ink[900],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  footnote: { fontSize: fontSize.xs, color: color.ink[500], textAlign: 'center' },
});
