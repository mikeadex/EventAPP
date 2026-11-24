import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette, radiusExtra, type ThemeName } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';

/**
 * Loading, empty and error states.
 *
 * `scheme` defaults to **dark**, the refresh's default ground. Screens that
 * have not been migrated yet pass `scheme="light"` explicitly; each of those
 * can drop the prop as its screen lands, and the light branch goes when the
 * last one has. (It was the other way round before the refresh — the old
 * `tone` prop on Skeleton is this, renamed, so all four components say it the
 * same way.)
 */

// ─── Skeleton pulse ──────────────────────────────────────────────────────────
//
// One module-level Animated.Value drives every skeleton block on screen, so
// they all breathe in unison instead of flickering out of phase. The loop is
// reference-counted: it starts when the first Skeleton mounts and stops when
// the last one unmounts, so nothing animates on settled screens.
const pulse = new Animated.Value(0.55);
let pulseUsers = 0;
let pulseLoop: Animated.CompositeAnimation | null = null;

function retainPulse(): void {
  if (pulseUsers++ === 0) {
    pulse.setValue(0.55);
    pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 850, useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
  }
}

function releasePulse(): void {
  if (--pulseUsers === 0) {
    pulseLoop?.stop();
    pulseLoop = null;
  }
}

/**
 * Animated placeholder block. Size and shape come from `style`; a
 * style-supplied backgroundColor or borderRadius wins over the defaults.
 */
export function Skeleton({
  style,
  scheme = 'dark',
}: {
  style?: StyleProp<ViewStyle>;
  scheme?: ThemeName;
}) {
  useEffect(() => {
    retainPulse();
    return releasePulse;
  }, []);
  return (
    <Animated.View
      style={[
        {
          backgroundColor: scheme === 'dark' ? theme.dark.surface : theme.light.surfaceRaised,
          borderRadius: radius.md,
        },
        style,
        { opacity: pulse },
      ]}
    />
  );
}

/**
 * Fades children in on mount. Wrap the loaded content that replaces a
 * skeleton so the switch reads as an arrival rather than a snap — the
 * skeleton pulse eases out and the real screen breathes in over ~220ms.
 */
export function FadeIn({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [opacity]);
  return <Animated.View style={[{ flex: 1, opacity }, style]}>{children}</Animated.View>;
}

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The refresh states actions as a 1px accent outline on transparent, not a
 * filled block. Shared by the empty and error states so they cannot drift.
 */
function ActionButton({
  label,
  icon,
  onPress,
  scheme,
}: {
  label: string;
  icon?: IoniconName;
  onPress: () => void;
  scheme: ThemeName;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.btn,
        { borderColor: theme[scheme].accent },
        pressed && { backgroundColor: theme[scheme].accentTint },
      ]}
      onPress={onPress}
    >
      {icon ? <Ionicons name={icon} size={16} color={theme[scheme].accent} /> : null}
      <Text variant="footnote" tone="accent" scheme={scheme}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Centered spinner for first-load states. */
export function LoadingState({ label, scheme = 'dark' }: { label?: string; scheme?: ThemeName }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme[scheme].accent} />
      {label ? (
        <Text variant="body" tone="secondary" scheme={scheme} style={styles.centerText}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

/** Friendly empty state with an icon + message and optional call to action. */
export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
  scheme = 'dark',
}: {
  icon?: IoniconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  scheme?: ThemeName;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={theme[scheme].textMuted} />
      <Text variant="subtitle" scheme={scheme} style={styles.centerText}>
        {title}
      </Text>
      {message ? (
        <Text variant="body" tone="secondary" scheme={scheme} style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <ActionButton label={actionLabel} onPress={onAction} scheme={scheme} />
      ) : null}
    </View>
  );
}

/** Error state with a retry affordance. */
export function ErrorState({
  message,
  onRetry,
  scheme = 'dark',
}: {
  message?: string;
  onRetry?: () => void;
  scheme?: ThemeName;
}) {
  return (
    <View style={styles.center}>
      {/* The old `color.danger` was near-black — invisible on the dark ground. */}
      <Ionicons name="cloud-offline-outline" size={48} color={palette.coral[500]} />
      <Text variant="subtitle" scheme={scheme} style={styles.centerText}>
        Something went wrong
      </Text>
      <Text variant="body" tone="secondary" scheme={scheme} style={styles.message}>
        {message ?? 'Please check your connection and try again.'}
      </Text>
      {onRetry ? (
        <ActionButton label="Try again" icon="refresh" onPress={onRetry} scheme={scheme} />
      ) : null}
    </View>
  );
}

/** Lightweight list placeholder shown while the first page loads. */
export function ListSkeleton({
  rows = 4,
  height = 120,
  scheme = 'dark',
}: {
  rows?: number;
  height?: number;
  scheme?: ThemeName;
}) {
  return (
    <View style={{ paddingVertical: spacing[4] }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} scheme={scheme} style={[styles.skeleton, { height }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[2],
  },
  centerText: { marginTop: spacing[2], textAlign: 'center' },
  message: { textAlign: 'center', maxWidth: 280 },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    borderWidth: 1,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.full,
  },
  skeleton: {
    borderRadius: radiusExtra.card,
    marginBottom: spacing[4],
  },
});
