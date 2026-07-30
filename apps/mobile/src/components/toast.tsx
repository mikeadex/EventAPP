import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, spacing, radius, fontSize, fontWeight } from '@ekklesia/ui/tokens';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface ToastMessage {
  text: string;
  icon?: IoniconName;
  /** Monotonic key so repeat taps re-trigger even with identical text. */
  key: number;
}

/**
 * Minimal app-wide toast. A module-level emitter keeps call sites free of
 * context plumbing: any screen calls `showToast('Saved')` and the single
 * `ToastHost` mounted in the root layout renders it. Deliberately not a
 * library — one pill, one animation, matching the monochrome language.
 */
let emit: ((msg: ToastMessage) => void) | null = null;
let seq = 0;

export function showToast(text: string, icon?: IoniconName): void {
  emit?.({ text, icon, key: ++seq });
}

const VISIBLE_MS = 1700;
/** Sits above the floating tab bar (which clears ~110pt with margins). */
const BOTTOM_OFFSET = 126;

export function ToastHost() {
  const [msg, setMsg] = useState<ToastMessage | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    emit = setMsg;
    return () => {
      emit = null;
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    opacity.stopAnimation();
    rise.stopAnimation();
    rise.setValue(12);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, speed: 24, bounciness: 6, useNativeDriver: true }),
    ]).start();
    hideTimer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) setMsg(null);
        },
      );
    }, VISIBLE_MS);
  }, [msg, opacity, rise]);

  if (!msg) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.pill, { opacity, transform: [{ translateY: rise }] }]}
    >
      {msg.icon ? <Ionicons name={msg.icon} size={15} color={color.ink[0]} /> : null}
      <Text style={styles.text}>{msg.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: BOTTOM_OFFSET,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: color.ink[900],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radius.full,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { color: color.ink[0], fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
