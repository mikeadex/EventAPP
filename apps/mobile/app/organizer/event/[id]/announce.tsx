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
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, fontSize, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { showToast } from '@/components/toast';

const MAX = 500;

/**
 * Message everyone holding a ticket for this event.
 *
 * Deliberately plain, and deliberately a little discouraging. This lands on the
 * lock screen of every attendee at once and cannot be recalled, so the screen
 * says who will get it before the field, shows the count remaining, and asks
 * for a second tap to confirm. A host should feel the weight of it.
 */
export default function AnnounceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX && !pending;

  async function send() {
    if (!canSend) return;
    setPending(true);
    try {
      const res = await api<{ recipients: number; sent: number }>(
        `/v1/events/${id}/announce`,
        { method: 'POST', body: { message: trimmed } },
      );
      // Reports people, not devices — "sent to 12 devices" would puzzle a host
      // who knows they have 9 attendees.
      showToast(
        res.recipients === 0
          ? 'No attendees to notify yet'
          : `Sent to ${res.recipients} ${res.recipients === 1 ? 'attendee' : 'attendees'}`,
      );
      router.back();
    } catch (e) {
      setConfirming(false);
      showToast(describeApiError(e, 'Could not send announcement'));
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
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={24} color={theme.dark.textPrimary} />
        </Pressable>
        <Text style={styles.title}>Message attendees</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing[5], gap: spacing[4] }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.blurb}>
          This goes to everyone holding a ticket, as a notification on their phone.
          It can’t be edited or taken back once sent.
        </Text>

        <View>
          <TextInput
            value={message}
            onChangeText={(t) => {
              setMessage(t);
              // Any edit invalidates the confirmation — otherwise a second tap
              // could send text the host never re-read.
              setConfirming(false);
            }}
            placeholder="Doors open at 6pm, not 6.30 — sorry for the change!"
            placeholderTextColor={theme.dark.textMuted}
            style={styles.input}
            multiline
            maxLength={MAX}
            textAlignVertical="top"
          />
          <Text style={styles.count}>
            {MAX - message.length} characters left
          </Text>
        </View>

        {confirming ? (
          <Pressable
            style={[styles.send, styles.confirm, !canSend && { opacity: 0.5 }]}
            disabled={!canSend}
            onPress={() => void send()}
          >
            <Ionicons name="paper-plane" size={18} color={palette.coral[200]} />
            <Text style={styles.sendText}>{pending ? 'Sending…' : 'Tap again to send'}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.send, !canSend && { opacity: 0.5 }]}
            disabled={!canSend}
            onPress={() => setConfirming(true)}
          >
            <Text style={styles.sendText}>Send to attendees</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
  },
  title: { fontSize: fontSize.lg, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  blurb: { fontSize: fontSize.sm, color: theme.dark.textSecondary, lineHeight: 20 },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: fontSize.base,
    color: theme.dark.textPrimary,
  },
  count: { marginTop: spacing[2], fontSize: fontSize.xs, color: theme.dark.textMuted, textAlign: 'right' },
  send: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingVertical: spacing[4],
  },
  confirm: { backgroundColor: 'rgba(217,86,74,0.18)', borderColor: 'rgba(217,86,74,0.5)' },
  sendText: { color: palette.coral[200], fontSize: fontSize.base },
});
