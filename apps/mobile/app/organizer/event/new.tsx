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
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api } from '@/lib/api';
import { showToast } from '@/components/toast';
import {
  EventForm,
  emptyEventForm,
  toEventBody,
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
      const created = await api<{ id: string }>(`/v1/organizations/${orgId}/events`, {
        method: 'POST',
        body: toEventBody(form),
      });
      if (publish) {
        await api(`/v1/events/${created.id}/publish`, { method: 'POST', body: {} });
      }
      showToast(publish ? 'Event published' : 'Draft saved', 'checkmark-circle');
      // Replace so the back button returns to the dashboard rather than a
      // half-filled form for an event that now exists.
      router.replace(`/organizer/event/${created.id}?orgId=${orgId}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Couldn't create the event");
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
        <EventForm value={form} onChange={setForm} disabled={pending} />

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
  primaryBtn: {
    backgroundColor: color.ink[900],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  primaryBtnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    alignItems: 'center',
  },
  secondaryBtnText: { color: color.ink[900], fontWeight: fontWeight.medium, fontSize: fontSize.base },
});
