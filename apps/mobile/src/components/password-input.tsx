import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, theme } from '@ekklesia/ui/tokens';

export interface PasswordInputProps
  extends Omit<TextInputProps, 'secureTextEntry' | 'style'> {
  /**
   * `current` on a sign-in form; `new` anywhere a password is being set.
   *
   * This is the whole reason the OS offers to remember anything. iOS Keychain
   * and Android Autofill decide what a field is from these hints, and every
   * password field in this app previously had none — so nothing was ever
   * offered to be saved, and nothing could ever be filled back in. People had
   * to retype their password every time their session legitimately expired.
   */
  purpose?: 'current' | 'new';
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * A password field that can be read back, and that the device will remember.
 *
 * The reveal toggle matters more on a phone than on a desktop: the keyboard is
 * small, the characters are hidden, and a 12-character minimum makes a silent
 * typo likely. Letting someone look is the difference between a second attempt
 * and a password reset.
 */
export function PasswordInput({
  purpose = 'current',
  containerStyle,
  ...rest
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.box, containerStyle]}>
      <TextInput
        placeholderTextColor={theme.dark.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={purpose === 'new' ? 'newPassword' : 'password'}
        autoComplete={purpose === 'new' ? 'new-password' : 'current-password'}
        {...rest}
        // After the spread: visibility is this component's to own, and a
        // caller passing secureTextEntry would silently break the toggle.
        secureTextEntry={!visible}
        style={styles.field}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        style={styles.toggle}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={20}
          color={theme.dark.textMuted}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Matches `authStyles.input` — this is the field directly under the email
  // one on every auth screen, and a white box beside a dark one is the most
  // visible possible way to get that wrong.
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(249,142,128,0.22)',
    marginBottom: spacing[3],
  },
  field: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    fontFamily: 'Alata_400Regular',
    color: theme.dark.textPrimary,
  },
  toggle: { paddingHorizontal: 16, paddingVertical: 15 },
});
