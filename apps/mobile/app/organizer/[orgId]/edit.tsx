import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { showToast } from '@/components/toast';
import { ErrorState } from '@/components/states';
import { canPickImages, pickImages, uploadImage } from '@/lib/upload';

interface Org {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  verificationStatus: string;
}

/** The four answers a reviewer needs before an organisation can be verified. */
interface Contact {
  contactName: string;
  contactEmail: string;
  addressLine1: string;
  city: string;
}

export default function EditOrganizationScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const insets = useSafeAreaInsets();

  const [org, setOrg] = useState<Org | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      // The only read route for an organisation is keyed by slug, and the
      // route carries the id. /v1/me lists both for every organisation the
      // caller belongs to, so resolve it there rather than relying on a
      // parameter every caller would have to remember to pass.
      const me = await api<{ memberships?: { organizationId: string; slug: string }[] }>('/v1/me');
      const mine = me.memberships?.find((m) => m.organizationId === orgId);
      if (!mine) {
        setLoadError('You are not a member of this organisation.');
        return;
      }
      const found = await api<Org>(`/v1/organizations/${mine.slug}`);
      setOrg(found);
      setName(found.name);
      setShortDescription(found.shortDescription ?? '');
      setDescription(found.description ?? '');
      setWebsiteUrl(found.websiteUrl ?? '');
      setLogoUrl(found.logoUrl);
      setLoadError(null);
    } catch (e) {
      setLoadError(describeApiError(e, 'Could not load your organisation'));
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function chooseLogo() {
    const picked = await pickImages({ multiple: false });
    if (!picked.ok) {
      if (picked.reason === 'denied') showToast('Allow photo access to add a logo');
      if (picked.reason === 'unsupported') showToast('Update the app to add a logo');
      return;
    }
    const chosen = picked.images[0];
    if (!chosen) return;

    setUploading(true);
    const up = await uploadImage(chosen, 'org_logo');
    setUploading(false);

    if (up.ok) {
      setLogoUrl(up.url);
      return;
    }
    if (up.reason === 'unavailable') {
      showToast('Photos are unavailable right now — try again later');
      return;
    }
    showToast(up.message ?? "Couldn't upload that logo");
  }

  async function save() {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      showToast('Give your organisation a name of at least 2 characters');
      return;
    }
    const site = websiteUrl.trim();
    if (site && !/^https?:\/\//i.test(site)) {
      showToast('The website must start with https://');
      return;
    }

    setPending(true);
    try {
      await api(`/v1/organizations/${orgId}`, {
        method: 'PATCH',
        body: {
          name: trimmedName,
          shortDescription: shortDescription.trim() || undefined,
          description: description.trim() || undefined,
          websiteUrl: site || undefined,
          logoUrl: logoUrl ?? undefined,
        },
      });
      showToast('Saved', 'checkmark-circle');
      router.back();
    } catch (e) {
      showToast(describeApiError(e, "Couldn't save your changes"));
    } finally {
      setPending(false);
    }
  }

  if (loadError) {
    return (
      <View style={[styles.c, { paddingTop: insets.top + spacing[2] }]}>
        <ErrorState message={loadError} onRetry={() => void load()} />
      </View>
    );
  }
  if (!org) {
    return (
      <View style={[styles.c, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.ink[900]} />
      </View>
    );
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
        <Text style={styles.h}>Your organisation</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: insets.bottom + spacing[10],
          gap: spacing[4],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <Pressable
            style={styles.logo}
            disabled={!canPickImages() || uploading || pending}
            onPress={() => void chooseLogo()}
            accessibilityRole="button"
            accessibilityLabel={logoUrl ? 'Change your logo' : 'Add a logo'}
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <Ionicons name="business-outline" size={28} color={color.ink[400]} />
            )}
            {uploading ? (
              <View style={[StyleSheet.absoluteFill, styles.logoBusy]}>
                <ActivityIndicator color={color.ink[0]} />
              </View>
            ) : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.logoTitle}>Logo</Text>
            <Text style={styles.logoHint}>
              Shown next to your name on your page and in the hosts list.
            </Text>
            {logoUrl && canPickImages() ? (
              <Pressable onPress={() => setLogoUrl(null)} hitSlop={8} disabled={pending}>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            editable={!pending}
            maxLength={120}
            autoCapitalize="words"
          />
        </Field>

        <Field label="Tagline" hint="One line, shown under your name.">
          <TextInput
            value={shortDescription}
            onChangeText={setShortDescription}
            placeholder="A church in east London"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
            editable={!pending}
            maxLength={280}
          />
        </Field>

        <Field label="About">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Who you are and what you do."
            placeholderTextColor={color.ink[300]}
            style={[styles.input, styles.multiline]}
            editable={!pending}
            multiline
            maxLength={5000}
          />
        </Field>

        <Field label="Website">
          <TextInput
            value={websiteUrl}
            onChangeText={setWebsiteUrl}
            placeholder="https://"
            placeholderTextColor={color.ink[300]}
            style={styles.input}
            editable={!pending}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </Field>

        <Field label="Web address" hint="Your permanent link. This cannot be changed.">
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.inputDisabledText}>ekklesiaevents.com/{org.slug}</Text>
          </View>
        </Field>

        <Pressable
          style={[styles.btn, (pending || uploading) && { opacity: 0.6 }]}
          disabled={pending || uploading}
          onPress={() => void save()}
        >
          {pending ? (
            <ActivityIndicator color={color.ink[0]} />
          ) : (
            <Text style={styles.btnText}>Save changes</Text>
          )}
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
  c: { flex: 1, backgroundColor: color.ink[0] },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink[900] },

  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: color.ink[100],
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoBusy: {
    backgroundColor: 'rgba(10,9,7,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: color.ink[900] },
  logoHint: { fontSize: fontSize.xs, color: color.ink[400], marginTop: 2 },
  remove: {
    fontSize: fontSize.xs,
    color: color.ink[500],
    fontWeight: fontWeight.medium,
    marginTop: spacing[1],
  },

  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: color.ink[900],
    marginBottom: spacing[1],
  },
  hint: { fontSize: fontSize.xs, color: color.ink[400], marginBottom: spacing[2] },
  input: {
    backgroundColor: color.ink[0],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.ink[200],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  inputDisabled: { backgroundColor: color.ink[50] },
  inputDisabledText: { fontSize: fontSize.base, color: color.ink[400] },

  btn: {
    backgroundColor: color.ink[900],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
});
