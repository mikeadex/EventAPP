import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { spacing, radius, theme, palette } from '@ekklesia/ui/tokens';
import { Text } from '@/components/text';
import { ACTIVE_BORDER, ACTIVE_FILL, CONTROL_BORDER } from '@/components/ui';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Minimal shape of the props expo-router's <Tabs tabBar={...}> passes through
// (from React Navigation) — we only need the route list + navigation actions.
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
}

// Filled glyph for the active (dark pill) state, outline for inactive.
const ICONS: Record<string, IoniconName> = {
  index: 'compass',
  hosts: 'business',
  tickets: 'ticket',
  saved: 'heart',
  profile: 'person',
};
const LABELS: Record<string, string> = {
  index: 'Discover',
  hosts: 'Hosts',
  tickets: 'Tickets',
  saved: 'Saved',
  profile: 'Profile',
};

/**
 * Floating pill tab bar — a raised capsule hovering above the content. The
 * focused tab expands into an accent-tinted pill showing icon + label; the
 * rest are icon-only.
 *
 * The refresh inverts it: the capsule was white with a near-black active pill,
 * and is now the dark surface with a coral wash behind a half-strength coral
 * edge — the same `ACTIVE_FILL` / `ACTIVE_BORDER` pair every other selected
 * control on the refreshed screens uses.
 */
export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, spacing[3]) }]}
      pointerEvents="box-none"
    >
      <View style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const base = ICONS[route.name];
          if (!base) return null;
          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              accessibilityLabel={LABELS[route.name]}
              style={[styles.item, focused && styles.itemActive]}
            >
              <Ionicons
                name={focused ? base : (`${base}-outline` as IoniconName)}
                size={20}
                color={focused ? theme.dark.accent : theme.dark.textSecondary}
              />
              {focused ? (
                <Text variant="footnote" style={styles.label}>
                  {LABELS[route.name]}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: theme.dark.surface,
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: CONTROL_BORDER,
    // Against a near-black ground a soft shadow does nothing, so the lift
    // comes from the border and a tighter, darker drop instead.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 18,
    elevation: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    width: 44,
    borderRadius: radius.full,
  },
  itemActive: {
    width: 'auto',
    paddingHorizontal: 18,
    gap: spacing[2],
    backgroundColor: ACTIVE_FILL,
    borderWidth: 1,
    borderColor: ACTIVE_BORDER,
  },
  label: { color: palette.coral[400] },
});
