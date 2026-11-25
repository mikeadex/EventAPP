import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { showToast } from '@/components/toast';
import {
  EventForm,
  emptyEventForm,
  toEventBody,
  toRecurrence,
  validateEventForm,
  type EventFormValues,
} from '@/components/organizer/event-form';

export default function NewEventScreen() {
  const { orgId } = useLocalSearchParams<{ orgId: string }>();
  const insets = useSafeAreaInsets();
  const [form, setForm] = useState<EventFormValues>(emptyEventForm());
  const [pending, setPending] = useState(false);

  async function create(publish: boolean) {
    const problem = validateEventForm(form);
    if (problem) {
      showToast(problem);
      return;
    }
    setPending(true);
    try {
      const recurrence = toRecurrence(form);

      // A series is a different endpoint with a different outcome: many
      // events rather than one. Publishing is per-series too, because
      // publishing twelve occurrences one at a time is not a thing anyone
      // should have to do.
      if (recurrence) {
        const made = await api<{ series: { id: string }; occurrences: { id: string }[] }>(
          `/v1/organizations/${orgId}/event-series`,
          { method: 'POST', body: { ...toEventBody(form, 'create'), recurrence } },
        );
        if (publish) {
          await api(`/v1/event-series/${made.series.id}/publish`, { method: 'POST', body: {} });
        }
        const n = made.occurrences.length;
        showToast(
          `${n} ${n === 1 ? 'date' : 'dates'} ${publish ? 'published' : 'saved as drafts'}`,
          'checkmark-circle',
        );
        router.replace(`/organizer/event/${made.occurrences[0]!.id}?orgId=${orgId}`);
        return;
      }

      const created = await api<{ id: string }>(`/v1/organizations/${orgId}/events`, {
        method: 'POST',
        body: toEventBody(form, 'create'),
      });
      if (publish) {
        await api(`/v1/events/${created.id}/publish`, { method: 'POST', body: {} });
      }
      showToast(publish ? 'Event published' : 'Draft saved', 'checkmark-circle');
      // Replace so the back button returns to the dashboard rather than a
      // half-filled form for an event that now exists.
      router.replace(`/organizer/event/${created.id}?orgId=${orgId}`);
    } catch (e) {
      showToast(describeApiError(e, "Couldn't create the event"));
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
          <Ionicons name="chevron-back" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text style={styles.h}>New event</Text>
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
        <EventForm value={form} onChange={setForm} disabled={pending} showRepeat />

        <Pressable
          style={[styles.primaryBtn, pending && { opacity: 0.6 }]}
          disabled={pending}
          onPress={() => void create(true)}
        >
          <Text style={styles.primaryBtnText}>{pending ? 'Working…' : 'Publish now'}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          disabled={pending}
          onPress={() => void create(false)}
        >
          <Text style={styles.secondaryBtnText}>Save as draft</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
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
  primaryBtn: {
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnText: {
    color: palette.coral[200],
    fontFamily: 'Alata_400Regular',
    fontSize: fontSize.base,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.dark.textPrimary,
    fontFamily: 'Alata_400Regular',
    fontSize: fontSize.base,
  },
});
