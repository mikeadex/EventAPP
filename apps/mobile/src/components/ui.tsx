import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette, radiusExtra } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { Gradient } from '@/components/gradient';

/**
 * The parts every refreshed screen is built from.
 *
 * Extracted because the four tab screens draw the same card surface, the same
 * monogram tile and the same pill, and the handoff gives each a single set of
 * values. Keeping them in one place is what stops the fourth screen's border
 * from being `0.16` where the first screen's is `0.14`.
 *
 * Dark only for now. The light variants exist in the handoff but no screen
 * renders them yet, so adding a `scheme` prop here would be guessing at an
 * API with nothing to check it against.
 */

/** The accent-tinted hairline every surface in the refresh is outlined with. */
export const CARD_BORDER = 'rgba(249,142,128,0.14)';
/** Slightly stronger, for controls rather than surfaces. */
export const CONTROL_BORDER = 'rgba(249,142,128,0.16)';
/** Active/selected: a wash of accent behind a half-strength accent edge. */
export const ACTIVE_FILL = 'rgba(249,142,128,0.14)';
export const ACTIVE_BORDER = 'rgba(249,142,128,0.5)';

/** Screen title, with an optional count or location line beneath it. */
export function ScreenHeader({
  title,
  subtitle,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.headerText}>
        <Text variant="display" tone="onPhoto">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** The raised, accent-outlined surface list rows and cards sit on. */
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed, style]}
    >
      {children}
    </Pressable>
  );
}

/**
 * The lettered tile standing in for a missing avatar or logo.
 *
 * The handoff draws it as a 150° gradient between two near-blacks with an
 * accent edge — not a flat fill, which is why this is a component and not a
 * style object.
 */
export function MonogramTile({
  letter,
  size = 52,
  rounded = 14,
  style,
}: {
  letter: string;
  size?: number;
  /** Corner radius; pass `size / 2` for a circle. */
  rounded?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.monogram,
        { width: size, height: size, borderRadius: rounded },
        style,
      ]}
    >
      <Gradient
        angle={150}
        stops={[
          { at: 0, opacity: 1, color: '#2A1F21' },
          { at: 1, opacity: 1, color: '#150F11' },
        ]}
        style={{ borderRadius: rounded }}
      />
      <Text variant={size >= 64 ? 'display' : 'subtitle'} tone="onPhoto">
        {letter.toUpperCase()}
      </Text>
    </View>
  );
}

/** Filter chips, follow buttons, and anything else pill-shaped. */
export function Pill({
  label,
  active = false,
  icon,
  onPress,
  style,
}: {
  label: string;
  active?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <>
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={active ? theme.dark.accent : theme.dark.textSecondary}
        />
      ) : null}
      <Text variant="label" style={{ color: active ? palette.coral[200] : theme.dark.textSecondary }}>
        {label}
      </Text>
    </>
  );
  const pillStyle: StyleProp<ViewStyle> = [
    styles.pill,
    active ? styles.pillActive : styles.pillIdle,
    style,
  ];
  if (!onPress) return <View style={pillStyle}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pillStyle, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  );
}

/** A row that reads as tappable: content, then a chevron. */
export function ChevronRow({
  icon,
  label,
  sublabel,
  onPress,
  accent = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  sublabel?: string;
  onPress: () => void;
  /** The highlighted call-to-action treatment, e.g. "Host events". */
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, accent && styles.rowAccent, pressed && { opacity: 0.7 }]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={accent ? theme.dark.accent : theme.dark.textSecondary}
      />
      <View style={styles.rowText}>
        <Text variant="bodyLg" style={accent ? { color: palette.coral[200] } : undefined}>
          {label}
        </Text>
        {sublabel ? (
          <Text variant="caption" style={{ color: palette.warm[400] }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name="chevron-forward"
        size={18}
        color={accent ? theme.dark.accent : theme.dark.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[6],
    paddingBottom: spacing[5],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: { gap: 5 },
  card: {
    backgroundColor: theme.dark.surface,
    borderRadius: radiusExtra.sheet,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    overflow: 'hidden',
  },
  cardPressed: { opacity: 0.75 },
  monogram: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.32)',
    overflow: 'hidden',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: 9,
    paddingHorizontal: 17,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  pillIdle: { borderColor: CONTROL_BORDER },
  pillActive: { backgroundColor: ACTIVE_FILL, borderColor: ACTIVE_BORDER },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: 17,
    paddingHorizontal: 18,
  },
  rowAccent: {
    backgroundColor: 'rgba(249,142,128,0.09)',
    borderRadius: radiusExtra.sheet,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.42)',
    paddingVertical: 18,
  },
  rowText: { flex: 1, gap: 3 },
});
