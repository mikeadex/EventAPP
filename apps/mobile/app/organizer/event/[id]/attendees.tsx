import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
import { api } from '@/lib/api';
import { checkInTicket } from '@/lib/check-in';
import { canUseScanner } from '@/lib/scanner';
import { EmptyState, ErrorState } from '@/components/states';

interface Attendee {
  id: string;
  code: string;
  status: string;
  name: string;
  email: string | null;
  checkedInAt: string | null;
}

interface AttendeeList {
  items: Attendee[];
  total: number;
  checkedIn: number;
}

/**
 * An already-admitted ticket is the common case on a door, so the 409's
 * structured payload is rendered as a local time rather than an ISO string.
 */
export default function AttendeesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<AttendeeList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<TextInput>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        setList(await api<AttendeeList>(`/v1/events/${id}/tickets`));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load attendees');
      } finally {
        setRefreshing(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Takes the code explicitly when called from a row. Reading it from state
   * instead would see the value from the render this closure was created in —
   * `setCode` has not flushed yet, so the tap silently did nothing.
   */
  async function checkIn(explicitCode?: string) {
    const trimmed = (explicitCode ?? code).trim();
    if (!trimmed || pending) return;
    setPending(true);
    setResult(null);
    try {
      const res = await checkInTicket(id, trimmed);
      if (res.ok) {
        setResult({ ok: true, text: `${res.name} checked in` });
        setCode('');
        await load();
      } else {
        setResult({ ok: false, text: res.message });
      }
    } finally {
      setPending(false);
      // Stay in the field so codes can be entered one after another.
      input.current?.focus();
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
        <Text style={styles.h}>Attendees</Text>
        <View style={styles.backBtn} />
      </View>

      {list ? (
        <Text style={styles.count}>
          {list.checkedIn} of {list.total} checked in
        </Text>
      ) : null}

      <View style={styles.scanRow}>
        <TextInput
          ref={input}
          value={code}
          // Codes are upper-case; normalising as it is typed means what's on
          // screen matches what's on the ticket, whatever the keyboard does.
          onChangeText={(t) => setCode(t.toUpperCase())}
          onSubmitEditing={() => void checkIn()}
          placeholder="EK-XXXXXXXXXXX"
          placeholderTextColor={theme.dark.textMuted}
          style={styles.input}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
        />
        <Pressable
          style={[styles.checkBtn, (pending || !code.trim()) && { opacity: 0.5 }]}
          disabled={pending || !code.trim()}
          onPress={() => void checkIn()}
        >
          <Text style={styles.checkBtnText}>{pending ? '…' : 'Check in'}</Text>
        </Pressable>
      </View>

      {/* Withheld on builds without expo-camera, exactly as the social buttons
          are — this screen's JS reaches older installs over the air. */}
      {canUseScanner() && (
        <Pressable
          style={styles.scanBtn}
          onPress={() => router.push(`/organizer/event/${id}/scan`)}
        >
          <Ionicons name="qr-code-outline" size={18} color={theme.dark.textPrimary} />
          <Text style={styles.scanBtnText}>Scan tickets</Text>
        </Pressable>
      )}

      {result ? (
        <View style={[styles.result, !result.ok && styles.resultBad]}>
          <Ionicons
            name={result.ok ? 'checkmark-circle' : 'alert-circle-outline'}
            size={18}
            color={result.ok ? theme.dark.accent : '#D9A9A2'}
          />
          <Text style={[styles.resultText, !result.ok && styles.resultTextBad]}>{result.text}</Text>
        </View>
      ) : null}

      {error && !list ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !list ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.dark.textPrimary} />
        </View>
      ) : list.items.length === 0 ? (
        <EmptyState icon="people-outline" title="Nobody yet" message="Registrations will appear here." />
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingBottom: insets.bottom + spacing[8],
            gap: spacing[2],
          }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load('refresh')}
              tintColor={theme.dark.textMuted}
            />
          }
        >
          {list.items.map((a) => {
            const inAlready = a.status === 'CHECKED_IN';
            return (
              <View key={a.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {a.code}
                  </Text>
                </View>
                {inAlready ? (
                  <View style={styles.inBadge}>
                    <Ionicons name="checkmark" size={13} color={palette.coral[200]} />
                    <Text style={styles.inBadgeText}>In</Text>
                  </View>
                ) : (
                  <Pressable
                    hitSlop={6}
                    disabled={pending}
                    onPress={() => void checkIn(a.code)}
                    style={styles.tapIn}
                  >
                    <Text style={styles.tapInText}>Check in</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.dark.backgroundDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[2],
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  h: { fontSize: fontSize.lg, fontFamily: 'Alata_400Regular', color: theme.dark.textPrimary },
  count: {
    paddingHorizontal: spacing[5],
    fontSize: fontSize.sm,
    color: theme.dark.textSecondary,
  },
  scanRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    fontSize: fontSize.base,
    color: theme.dark.textPrimary,
    letterSpacing: 1,
  },
  checkBtn: {
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    justifyContent: 'center',
  },
  checkBtnText: { color: palette.coral[200] },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    marginTop: spacing[3],
  },
  scanBtnText: { fontSize: fontSize.base, color: theme.dark.textPrimary },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[5],
    marginTop: spacing[3],
    padding: spacing[3],
    borderRadius: radius.md,
    backgroundColor: 'rgba(249,142,128,0.14)',
  },
  resultBad: { backgroundColor: theme.dark.surfaceRaised },
  resultText: { flex: 1, color: palette.coral[200], fontSize: fontSize.sm },
  resultTextBad: { color: theme.dark.textPrimary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.dark.borderSubtle,
  },
  name: { fontSize: fontSize.base, color: theme.dark.textPrimary },
  sub: { fontSize: fontSize.xs, color: theme.dark.textMuted, marginTop: 2, letterSpacing: 0.5 },
  inBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(249,142,128,0.14)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
  },
  inBadgeText: { color: palette.coral[200], fontSize: fontSize.xs },
  tapIn: {
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    borderRadius: radius.full,
    paddingHorizontal: spacing[3],
    paddingVertical: 4,
  },
  tapInText: { fontSize: fontSize.xs, color: theme.dark.textSecondary },
});
