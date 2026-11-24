import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * "Use Face ID next time" (design 11).
 *
 * The session token is already in the keychain. This moves it to a keychain
 * entry whose access control requires the device owner, so reading it back
 * prompts for Face ID, Touch ID or the device passcode. No new native module:
 * expo-secure-store does it with `requireAuthentication`, and it is in both
 * shipped binaries.
 *
 * It does need one native thing, which is why `canUseBiometricLock()` exists
 * and is checked before any of this is offered — see that function.
 *
 * The protected entry is a SEPARATE key, not the same one with different
 * options. expo-secure-store's own documentation is explicit that
 * `requireAuthentication` "would not work in tandem with the keychainService
 * value used for the other non-authenticated operations", and a single key
 * read with the wrong options is a silent null rather than an error.
 */

/** The protected copy. Never read without `requireAuthentication`. */
const PROTECTED_KEY = 'ekklesia_session_token_bio';

/**
 * Whether the lock is on, in AsyncStorage rather than the keychain.
 *
 * It has to be readable without prompting. Keeping this flag in SecureStore
 * would mean a Face ID prompt just to discover whether to show a Face ID
 * prompt, and a cancelled one would leave the app unable to tell "turned off"
 * from "declined".
 */
const PREF_KEY = 'ekklesia.biometricLock';

const PROMPT = 'Unlock Ekklesia';

/**
 * Whether this device *and this binary* can do it.
 *
 * `canUseBiometricAuthentication()` answers the device half: hardware present
 * and an enrolled method secure enough to protect a key.
 *
 * The binary half is checked by `FACE_ID_READY_BUILD` below, not by that
 * call. On iOS, invoking Face ID without `NSFaceIDUsageDescription` in
 * Info.plist terminates the app, and a native build number is the one thing
 * this file can read that an over-the-air update cannot change — the JS here
 * can reach an older binary through an update, while that binary's Info.plist
 * stays as it was built.
 */
export function canUseBiometricLock(): boolean {
  try {
    return hasFaceIdPermission() && SecureStore.canUseBiometricAuthentication();
  } catch {
    return false;
  }
}

/**
 * The first native build carrying the `expo-secure-store` config plugin, and
 * therefore the permission string. Bumped in app.json in the same commit.
 *
 * Read from `expo-application`, which reports the Info.plist's own
 * CFBundleVersion. Deliberately not `Constants.expoConfig`: that comes from
 * the manifest, an update ships its own manifest, and a value an update can
 * change is worthless for describing the binary underneath it.
 */
const FACE_ID_READY_BUILD = 2;

function hasFaceIdPermission(): boolean {
  try {
    const build = Number(Application.nativeBuildVersion);
    return Number.isFinite(build) && build >= FACE_ID_READY_BUILD;
  } catch {
    return false;
  }
}

export async function isBiometricLockOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === '1';
  } catch {
    return false;
  }
}

/**
 * Move the session behind the device's own authentication.
 *
 * Returns false rather than throwing: the caller has just signed in
 * successfully, and a keychain that refuses to store the protected copy is a
 * reason to leave the toggle off, not to fail the sign-in.
 */
export async function enableBiometricLock(token: string): Promise<boolean> {
  try {
    // On iOS this does not prompt — creating a protected item is allowed,
    // only reading or replacing one asks. So turning the toggle on is silent
    // and the first prompt comes at the next launch, which is what "next
    // time" on the switch promises.
    await SecureStore.setItemAsync(PROTECTED_KEY, token, {
      requireAuthentication: true,
      authenticationPrompt: PROMPT,
    });
    await AsyncStorage.setItem(PREF_KEY, '1');
    return true;
  } catch {
    await disableBiometricLock();
    return false;
  }
}

/** Turn it off and leave nothing behind. Safe to call when it was never on. */
export async function disableBiometricLock(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREF_KEY);
  } catch {
    // The protected entry is the thing that matters; keep going.
  }
  try {
    await SecureStore.deleteItemAsync(PROTECTED_KEY, { requireAuthentication: true });
  } catch {
    // Deleting a protected entry can itself require authentication. Nothing
    // useful to do if it is refused — the flag is already cleared, so the app
    // will not try to read it again.
  }
}

/**
 * Prompt, and return the session token if the person is who they say.
 *
 * Null covers three different things on purpose — cancelled, failed, and the
 * key having been invalidated — because the app's response to all three is
 * the same: carry on signed out and let them in another way.
 *
 * The invalidation case is worth knowing about: the system destroys the key
 * when biometrics change, so enrolling a new fingerprint or re-doing Face ID
 * makes the stored token permanently unreadable. That is the feature working
 * — someone else's face must not open the session — but it means a null here
 * can be final, so the flag is cleared rather than left to prompt forever.
 */
export async function unlockSessionToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(PROTECTED_KEY, {
      requireAuthentication: true,
      authenticationPrompt: PROMPT,
    });
    if (!token) {
      // No entry, or an invalidated key. Either way there is nothing to come
      // back to, so stop claiming the lock is on.
      await disableBiometricLock();
      return null;
    }
    return token;
  } catch {
    // Cancelled or failed. The entry is still there and still good, so the
    // flag stays on and the next attempt can succeed.
    return null;
  }
}
