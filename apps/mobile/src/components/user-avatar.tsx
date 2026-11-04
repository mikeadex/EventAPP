import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { color } from '@ekklesia/ui/tokens';

/**
 * A person's picture, their initial, or the signed-out glyph — in that order.
 *
 * Three screens drew this by hand and all three rendered the initial only, so
 * `user.image` was stored by Better Auth and displayed nowhere. Picking a
 * photograph and then seeing the same letter you saw before is worse than not
 * offering the photograph, so the fallback chain lives in one place now.
 *
 * The caller keeps its own container style — the Discover header's avatar sits
 * on a photograph and carries a translucent backing the profile page's does
 * not — and passes the size so the image can be clipped to a circle without
 * assuming one.
 */
export function UserAvatar({
  uri,
  initial,
  size,
  style,
  textStyle,
  signedOutColor = color.ink[500],
}: {
  /** `session.user.image`. Null or absent falls through to the initial. */
  uri?: string | null;
  /** Null means nobody is signed in, which is a different picture entirely. */
  initial?: string | null;
  size: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  signedOutColor?: string;
}) {
  return (
    <View style={[{ overflow: 'hidden' }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ) : initial ? (
        <Text style={textStyle}>{initial}</Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.43)} color={signedOutColor} />
      )}
    </View>
  );
}
