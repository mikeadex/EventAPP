import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the welcome screen has been shown.
 *
 * Deliberately AsyncStorage rather than SecureStore: this is a UI preference,
 * not a secret, and SecureStore is the keychain — which on iOS survives an
 * uninstall. Someone who deletes the app and reinstalls it should get the
 * first-run screen again, because to them it genuinely is a first run.
 */
const KEY = 'ekklesia.welcomeSeen';

/**
 * Storage failures resolve to "seen" in both directions.
 *
 * The welcome screen is a nicety; the app is the point. If the device cannot
 * answer, showing the app is the safe failure and showing a gate is not — a
 * storage error that put the welcome screen in front of someone on every
 * launch would be indistinguishable from the app being broken.
 */
export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, '1');
  } catch {
    // Worst case it shows once more. Not worth surfacing.
  }
}
