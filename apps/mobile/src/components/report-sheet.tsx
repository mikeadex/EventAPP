import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REPORT_REASONS, type ReportReason } from '@ekklesia/shared';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';
import { api, describeApiError } from '@/lib/api';
import { showToast } from '@/components/toast';

/** Wording people recognise, in the order they are most likely to need it. */
const LABELS: Record<ReportReason, string> = {
  misleading: "It's misleading or won't happen as described",
  spam: "It's spam or a scam",
  hate_or_harassment: 'Hate speech or harassment',
  safeguarding: 'A safeguarding concern',
  sexual_content: 'Sexual content',
  violence: 'Violence or threats',
  impersonation: 'Impersonating someone',
  other: 'Something else',
};

/** Reasons that deserve saying more about, so the box opens for them. */
const ORDER: ReportReason[] = [
  'misleading',
  'spam',
  'hate_or_harassment',
  'safeguarding',
  'sexual_content',
  'violence',
  'impersonation',
  'other',
];

export type ReportTarget =
  | { eventId: string }
  | { organizationId: string }
  | { userId: string };

/**
 * Reporting something, from wherever you saw it.
 *
 * Deliberately short: a person reporting a safeguarding concern is not in the
 * mood for a form. One tap picks a reason, the details box is optional, and
 * anything beyond that can be asked by email once a human is involved.
 *
 * Always confirms it was received. A report that vanishes silently teaches
 * people not to bother next time.
 */
export function ReportSheet({
  visible,
  onClose,
  target,
  what,
}: {
  visible: boolean;
  onClose: () => void;
  target: ReportTarget;
  /** What is being reported, for the heading — "this event", "this host". */
  what: string;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await api('/v1/reports', {
        method: 'POST',
        body: { reason, details: details.trim() || undefined, ...target },
      });
      showToast('Thanks — we review reports within 24 hours');
      setReason(null);
      setDetails('');
      onClose();
    } catch (e) {
      showToast(describeApiError(e, 'Could not send that report'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.c}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={24} color={color.ink[900]} />
          </Pressable>
          <Text style={styles.title}>Report {what}</Text>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: spacing[5], gap: spacing[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.blurb}>
            Tell us what's wrong and we'll look into it. Reports are private — the
            person or organisation you're reporting isn't told who reported them.
          </Text>

          <View style={{ gap: spacing[2] }}>
            {ORDER.filter((r) => REPORT_REASONS.includes(r)).map((r) => (
              <Pressable
                key={r}
                onPress={() => setReason(r)}
                style={[styles.option, reason === r && styles.optionOn]}
              >
                <Ionicons
                  name={reason === r ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={reason === r ? color.ink[900] : color.ink[400]}
                />
                <Text style={styles.optionText}>{LABELS[r]}</Text>
              </Pressable>
            ))}
          </View>

          {reason && (
            <View>
              <Text style={styles.label}>Anything else? (optional)</Text>
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder="What happened?"
                placeholderTextColor={color.ink[300]}
                style={styles.input}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>
          )}

          <Pressable
            style={[styles.send, (!reason || busy) && { opacity: 0.5 }]}
            disabled={!reason || busy}
            onPress={() => void submit()}
          >
            {busy ? (
              <ActivityIndicator color={color.ink[0]} />
            ) : (
              <Text style={styles.sendText}>Send report</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: color.ink[0] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[5],
    paddingBottom: spacing[3],
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.ink[900] },
  blurb: { fontSize: fontSize.sm, color: color.ink[500], lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    padding: spacing[4],
  },
  optionOn: { borderColor: color.ink[900] },
  optionText: { flex: 1, fontSize: fontSize.sm, color: color.ink[900] },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: color.ink[700], marginBottom: spacing[2] },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    padding: spacing[3],
    fontSize: fontSize.base,
    color: color.ink[900],
  },
  send: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.ink[900],
    borderRadius: radius.full,
    paddingVertical: spacing[4],
    marginTop: spacing[2],
  },
  sendText: { color: color.ink[0], fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
