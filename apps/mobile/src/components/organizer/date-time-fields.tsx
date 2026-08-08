import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';

/**
 * Date and time pickers built from plain React Native.
 *
 * Deliberately not @react-native-community/datetimepicker: a native module
 * would mean a new binary and a store round trip, and the whole organiser flow
 * currently ships over the air. Values stay as the same 'YYYY-MM-DD' and
 * 'HH:MM' strings the form already used, so validation and the request body are
 * untouched.
 */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function parseYmd(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Sat 16 Aug 2026" — or a prompt when nothing is chosen yet. */
function readableDate(value: string): string | null {
  const d = parseYmd(value);
  if (!d) return null;
  try {
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

/** Monday-first, since this is a UK-first product. */
function monthGrid(view: Date): (Date | null)[] {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const leading = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array(leading).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = parseYmd(value);
  const [view, setView] = useState<Date>(() => selected ?? new Date());
  const cells = useMemo(() => monthGrid(view), [view]);
  const todayKey = ymd(new Date());

  function choose(d: Date) {
    onChange(ymd(d));
    setOpen(false);
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => {
          setView(parseYmd(value) ?? new Date());
          setOpen(true);
        }}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]}>
          {readableDate(value) ?? 'Choose a date'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={color.ink[400]} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.monthBar}>
              <Pressable
                hitSlop={10}
                onPress={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
              >
                <Ionicons name="chevron-back" size={22} color={color.ink[900]} />
              </Pressable>
              <Text style={styles.monthLabel}>
                {MONTHS[view.getMonth()]} {view.getFullYear()}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
              >
                <Ionicons name="chevron-forward" size={22} color={color.ink[900]} />
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEKDAYS.map((w) => (
                <Text key={w} style={styles.weekday}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((d, i) => {
                if (!d) return <View key={`blank-${i}`} style={styles.cell} />;
                const key = ymd(d);
                const isSelected = key === value;
                const isToday = key === todayKey;
                return (
                  <Pressable
                    key={key}
                    onPress={() => choose(d)}
                    style={[styles.cell, isSelected && styles.cellOn]}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isSelected && styles.cellTextOn,
                        isToday && !isSelected && styles.cellToday,
                      ]}
                    >
                      {d.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <Pressable style={styles.ghostBtn} onPress={() => choose(new Date())}>
                <Text style={styles.ghostBtnText}>Today</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={() => setOpen(false)}>
                <Text style={styles.ghostBtnText}>Close</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => pad(h));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [h, m] = value.split(':');
  const hour = HOURS.includes(h) ? h : '';
  // Round an off-step minute to the nearest listed one so an existing event
  // whose time is, say, 10:33 still highlights something sensible.
  const minute = m ? MINUTES.reduce((a, b) =>
    Math.abs(Number(b) - Number(m)) < Math.abs(Number(a) - Number(m)) ? b : a,
  ) : '';

  const set = (nextH: string, nextM: string) => onChange(`${nextH}:${nextM}`);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[styles.field, disabled && styles.fieldDisabled]}
      >
        <Text style={[styles.fieldText, !value && styles.placeholder]}>{value || 'Choose'}</Text>
        <Ionicons name="time-outline" size={18} color={color.ink[400]} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.columns}>
              <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
                {HOURS.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => set(opt, minute || '00')}
                    style={[styles.option, opt === hour && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, opt === hour && styles.optionTextOn]}>{opt}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={styles.colon}>:</Text>
              <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
                {MINUTES.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => set(hour || '09', opt)}
                    style={[styles.option, opt === minute && styles.optionOn]}
                  >
                    <Text style={[styles.optionText, opt === minute && styles.optionTextOn]}>{opt}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <Pressable style={styles.doneBtn} onPress={() => setOpen(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: color.ink[900] },
  field: {
    marginTop: spacing[2],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: color.ink[200],
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { fontSize: fontSize.base, color: color.ink[900] },
  placeholder: { color: color.ink[300] },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing[5],
  },
  sheet: {
    backgroundColor: color.ink[0],
    borderRadius: radius['2xl'],
    padding: spacing[5],
  },
  sheetTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: color.ink[900],
    textAlign: 'center',
    marginBottom: spacing[3],
  },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[4],
  },
  monthLabel: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: color.ink[900] },
  weekRow: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    color: color.ink[400],
    marginBottom: spacing[2],
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
  },
  cellOn: { backgroundColor: color.ink[900] },
  cellText: { fontSize: fontSize.base, color: color.ink[900] },
  cellTextOn: { color: color.ink[0], fontWeight: fontWeight.semibold },
  cellToday: { fontWeight: fontWeight.bold, textDecorationLine: 'underline' },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[4],
  },
  ghostBtn: { paddingVertical: spacing[2], paddingHorizontal: spacing[3] },
  ghostBtnText: { color: color.ink[700], fontWeight: fontWeight.medium },

  columns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 220 },
  column: { width: 84 },
  colon: { fontSize: fontSize.xl, color: color.ink[400], paddingHorizontal: spacing[2] },
  option: { paddingVertical: spacing[3], alignItems: 'center', borderRadius: radius.md },
  optionOn: { backgroundColor: color.ink[900] },
  optionText: { fontSize: fontSize.base, color: color.ink[900] },
  optionTextOn: { color: color.ink[0], fontWeight: fontWeight.semibold },
  doneBtn: {
    marginTop: spacing[4],
    backgroundColor: color.ink[900],
    borderRadius: radius.full,
    paddingVertical: spacing[3],
    alignItems: 'center',
  },
  doneBtnText: { color: color.ink[0], fontWeight: fontWeight.semibold },
});
