import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';

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
 * Floating pill tab bar — white rounded capsule that hovers above content. The
 * focused tab expands into a dark pill showing icon + label; the rest are
 * icon-only. (Signature pattern from the reference designs.)
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
                color={focused ? color.ink[0] : color.ink[400]}
              />
              {focused ? <Text style={styles.label}>{LABELS[route.name]}</Text> : null}
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
    backgroundColor: color.ink[0],
    borderRadius: radius.full,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[2],
    borderWidth: 1,
    borderColor: color.ink[100],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
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
    paddingHorizontal: spacing[4],
    gap: spacing[2],
    backgroundColor: color.ink[900],
  },
  label: {
    color: color.ink[0],
    fontWeight: fontWeight.semibold,
    fontSize: fontSize.sm,
  },
});
