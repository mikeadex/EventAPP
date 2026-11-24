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
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { api, ApiError, describeApiError } from '@/lib/api';
import { showToast } from '@/components/toast';

const KINDS = [
  { value: 'church', label: 'Church', hint: 'A congregation that meets regularly' },
  { value: 'ministry', label: 'Ministry', hint: 'An organisation serving a wider mission' },
  { value: 'community', label: 'Community', hint: 'A faith-based group or network' },
] as const;

const COUNTRIES = ['GB', 'IE', 'US'] as const;
const CURRENCY_FOR: Record<(typeof COUNTRIES)[number], string> = { GB: 'GBP', IE: 'EUR', US: 'USD' };

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

/** Mirrors the server's rule: lowercase, hyphens, no leading or trailing dash. */
const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Local rather than `slugify` from @ekklesia/shared: Metro resolves that
 * package to its TypeScript source, whose `export * from './slug.js'` has no
 * matching file, so importing it red-screens the app.
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

const STEPS = ['Your organisation', 'Where you meet', 'Who we contact'] as const;

export default function BecomeAHostScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);

  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('church');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [country, setCountry] = useState<(typeof COUNTRIES)[number]>('GB');

  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');

  // The address follows the name until edited by hand, after which it is left
  // alone — renaming shouldn't silently change a link already shared.
  function onNameChange(v: string) {
    setName(v);
    if (!slugEdited) setSlug(toSlug(v));
  }

  const slugProblem =
    slug.length > 0 && (slug.length < 3 || slug.length > 60 || !SLUG_RE.test(slug))
      ? 'Use lowercase letters, numbers and hyphens.'
      : null;

  const stepValid = [
    name.trim().length >= 2 && slug.length >= 3 && !slugProblem,
    addressLine1.trim().length > 0 && city.trim().length > 0,
    contactName.trim().length > 0 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail.trim()),
  ][step];

  async function submit() {
    setPending(true);
    try {
      const org = await api<{ id: string }>('/v1/organizations', {
        method: 'POST',
        body: {
          name: name.trim(),
          slug,
          kind,
          country,
          currency: CURRENCY_FOR[country],
          shortDescription: shortDescription.trim() || undefined,
          description: description.trim() || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim(),
          contactPhone: contactPhone.trim() || undefined,
          addressLine1: addressLine1.trim(),
          city: city.trim(),
          postalCode: postalCode.trim() || undefined,
        },
      });
      showToast('Sent for review — you can publish events now', 'checkmark-circle');
      router.replace(`/organizer/${org.id}`);
    } catch (e) {
      // A taken address is the one failure a host can fix themselves, so send
      // them back to the step that owns it.
      if (e instanceof ApiError && e.status === 409) {
        setStep(0);
        showToast('That address is taken — try another');
      } else {
        showToast(describeApiError(e, "Couldn't set up your host profile"));
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
        <Pressable
          onPress={() => (step === 0 ? router.back() : setStep(step - 1))}
          hitSlop={8}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text style={styles.h}>Become a host</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressBar, i <= step && styles.progressBarOn]} />
        ))}
      </View>
      <Text style={styles.stepLabel}>
        Step {step + 1} of {STEPS.length} · {STEPS[step]}
      </Text>

      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: insets.bottom + spacing[10],
          gap: spacing[5],
        }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 0 && (
          <>
            <Text style={styles.intro}>
              Tell us who you are. This is what people see when they find your events.
            </Text>

            <View>
              <Text style={styles.label}>What kind of host are you?</Text>
              <View style={{ gap: spacing[2], marginTop: spacing[3] }}>
                {KINDS.map((k) => {
                  const on = kind === k.value;
                  return (
                    <Pressable
                      key={k.value}
                      onPress={() => setKind(k.value)}
                      style={[styles.choice, on && styles.choiceOn]}
                    >
                      <Ionicons
                        name={on ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={on ? theme.dark.accent : theme.dark.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.choiceLabel}>{k.label}</Text>
                        <Text style={styles.choiceHint}>{k.hint}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Field label="Host name" hint="Shown on your page and on every event you publish.">
              <TextInput
                value={name}
                onChangeText={onNameChange}
                placeholder="Grace Community Church"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                maxLength={120}
              />
            </Field>

            <View>
              <Text style={styles.label}>Page address</Text>
              <Text style={styles.hint}>
                {WEB_URL ? `${WEB_URL.replace(/^https?:\/\//, '')}/` : 'ekklesia.app/'}
                {slug || 'your-host'}
              </Text>
              <TextInput
                value={slug}
                onChangeText={(v) => {
                  setSlugEdited(true);
                  setSlug(v.toLowerCase().replace(/\s+/g, '-'));
                }}
                placeholder="grace-community-church"
                placeholderTextColor={theme.dark.textMuted}
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
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.intro}>
              Where do you normally meet? We use this to check you&apos;re a real organisation, and
              to show people events near them.
            </Text>

            <Field label="Address">
              <TextInput
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="2 Chapel Road"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                maxLength={200}
              />
            </Field>

            <Field label="Town or city">
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Leeds"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                maxLength={120}
              />
            </Field>

            <Field label="Postcode" hint="Optional, but it helps us verify you faster.">
              <TextInput
                value={postalCode}
                onChangeText={setPostalCode}
                placeholder="LS1 4AB"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                autoCapitalize="characters"
                maxLength={20}
              />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.intro}>
              Who should we speak to? These details are for verification and support only — they
              are never shown publicly.
            </Text>

            <Field label="Your name">
              <TextInput
                value={contactName}
                onChangeText={setContactName}
                placeholder="Jane Smith"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                maxLength={120}
              />
            </Field>

            <Field label="Contact email" hint="Ideally one at your own domain.">
              <TextInput
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="jane@yourchurch.org"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />
            </Field>

            <Field label="Phone" hint="Optional.">
              <TextInput
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="07700 900000"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                keyboardType="phone-pad"
                maxLength={40}
              />
            </Field>

            <Field label="Website" hint="Optional. Speeds verification up considerably.">
              <TextInput
                value={websiteUrl}
                onChangeText={setWebsiteUrl}
                placeholder="https://yourchurch.org"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </Field>

            <Field label="One line about you" hint="Optional. Sits under your name and on event cards.">
              <TextInput
                value={shortDescription}
                onChangeText={setShortDescription}
                placeholder="A family church in the heart of Leeds"
                placeholderTextColor={theme.dark.textMuted}
                style={styles.input}
                editable={!pending}
                maxLength={280}
              />
            </Field>

            <Field
              label="About your host"
              hint="Optional. The fuller story on your page — who you are, what a visit is like, who's welcome."
            >
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={
                  'We’re a family church that’s met in Leeds since 1998.\n\n' +
                  'Sundays are relaxed — come as you are. There’s tea afterwards, ' +
                  'kids’ groups during the service, and someone on the door who’ll ' +
                  'happily show you around.'
                }
                placeholderTextColor={theme.dark.textMuted}
                style={[styles.input, styles.multiline]}
                editable={!pending}
                multiline
                textAlignVertical="top"
                maxLength={5000}
              />
              <Text style={styles.counter}>{description.length}/5000</Text>
            </Field>

            <Text style={styles.footnote}>
              We review new hosts by hand. You can publish events straight away — a verified badge
              appears on your page once we&apos;ve checked the details.
            </Text>
          </>
        )}

        <Pressable
          style={[styles.primaryBtn, (!stepValid || pending) && { opacity: 0.5 }]}
          disabled={!stepValid || pending}
          onPress={() => (step < STEPS.length - 1 ? setStep(step + 1) : void submit())}
        >
          <Text style={styles.primaryBtnText}>
            {pending ? 'Setting up…' : step < STEPS.length - 1 ? 'Continue' : 'Submit for review'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: fontSize.lg, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  progress: {
    flexDirection: 'row',
    gap: spacing[2],
    paddingHorizontal: spacing[5],
    marginTop: spacing[2],
  },
  progressBar: { flex: 1, height: 3, borderRadius: 2, backgroundColor: theme.dark.surfaceRaised },
  progressBarOn: { backgroundColor: 'rgba(249,142,128,0.14)' },
  stepLabel: {
    paddingHorizontal: spacing[5],
    marginTop: spacing[2],
    fontSize: fontSize.xs,
    color: theme.dark.textSecondary,
  },
  intro: { fontSize: fontSize.base, color: theme.dark.textSecondary, lineHeight: 22 },
  label: { fontSize: fontSize.sm, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  hint: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  error: { fontSize: fontSize.xs, color: theme.dark.textPrimary, marginTop: spacing[2] },
  multiline: { minHeight: 140 },
  counter: {
    marginTop: spacing[1],
    fontSize: fontSize.xs,
    color: theme.dark.textMuted,
    textAlign: 'right',
  },
  input: {
    marginTop: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: theme.dark.textPrimary,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.lg,
    padding: spacing[4],
  },
  choiceOn: { borderColor: 'rgba(249,142,128,0.55)' },
  choiceLabel: { fontSize: fontSize.base, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  choiceHint: { fontSize: fontSize.xs, color: theme.dark.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  chipOn: { backgroundColor: 'rgba(249,142,128,0.14)', borderColor: 'rgba(249,142,128,0.55)' },
  chipText: { fontSize: fontSize.sm, color: theme.dark.textSecondary },
  chipTextOn: { color: palette.coral[200] },
  primaryBtn: {
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnText: { color: palette.coral[200], fontFamily: 'Alata_400Regular', fontSize: fontSize.base },
  footnote: { fontSize: fontSize.xs, color: theme.dark.textSecondary, lineHeight: 18 },
});
