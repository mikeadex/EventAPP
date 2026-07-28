import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Centered spinner for first-load states. */
export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={color.brand[600]} />
      {label ? <Text style={styles.muted}>{label}</Text> : null}
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
}: {
  icon?: IoniconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={48} color={color.ink[300]} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable style={styles.btn} onPress={onAction}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Error state with a retry affordance. */
export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="cloud-offline-outline" size={48} color={color.danger} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.muted}>{message ?? 'Please check your connection and try again.'}</Text>
      {onRetry ? (
        <Pressable style={styles.btn} onPress={onRetry}>
          <Ionicons name="refresh" size={16} color={color.ink[0]} />
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Lightweight list placeholder shown while the first page loads. */
export function ListSkeleton({ rows = 4, height = 120 }: { rows?: number; height?: number }) {
  return (
    <View style={{ paddingVertical: spacing[4] }}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.skeleton, { height }]} />
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
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: color.ink[800],
    marginTop: spacing[2],
    textAlign: 'center',
  },
  muted: {
    color: color.ink[400],
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 280,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    backgroundColor: color.brand[600],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.md,
  },
  btnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
  skeleton: {
    backgroundColor: color.ink[100],
    borderRadius: radius.lg,
    marginBottom: spacing[4],
  },
});
