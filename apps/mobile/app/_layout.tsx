import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';

/**
 * Root error boundary — expo-router renders this (instead of a redbox/blank
 * screen) when any route in the tree throws during render. `retry` re-mounts
 * the failed segment so a transient error can recover without a full reload.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.errC}>
      <Ionicons name="alert-circle-outline" size={56} color={color.danger} />
      <Text style={styles.errTitle}>This screen hit a snag</Text>
      <Text style={styles.errMsg}>
        An unexpected error occurred. You can try again, and if it keeps
        happening please let us know.
      </Text>
      <ScrollView style={styles.errDetail} contentContainerStyle={{ padding: spacing[3] }}>
        <Text style={styles.errDetailText}>{error.message}</Text>
      </ScrollView>
      <Pressable style={styles.errBtn} onPress={retry}>
        <Ionicons name="refresh" size={16} color={color.ink[0]} />
        <Text style={styles.errBtnText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        {/* Full-screen search slides up as a modal. */}
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  errC: {
    flex: 1,
    backgroundColor: color.ink[50],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[6],
    gap: spacing[2],
  },
  errTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: color.ink[900],
    marginTop: spacing[2],
  },
  errMsg: {
    color: color.ink[500],
    fontSize: fontSize.sm,
    textAlign: 'center',
    maxWidth: 300,
  },
  errDetail: {
    maxHeight: 140,
    alignSelf: 'stretch',
    backgroundColor: color.ink[100],
    borderRadius: radius.md,
    marginTop: spacing[4],
  },
  errDetailText: {
    fontFamily: 'Courier',
    fontSize: fontSize.xs,
    color: color.ink[600],
  },
  errBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[4],
    backgroundColor: color.brand[600],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[6],
    borderRadius: radius.md,
  },
  errBtnText: { color: color.ink[0], fontWeight: fontWeight.semibold, fontSize: fontSize.base },
});
