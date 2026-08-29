import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Whether this binary can open the camera.
 *
 * Gated exactly like social sign-in, and for the same reason: this file's JS
 * reaches existing installs over the air, but expo-camera's native module only
 * exists in builds made after it was added. `requireOptionalNativeModule`
 * answers with null rather than throwing, so the scan button can be withheld
 * instead of crashing when tapped.
 */
export function canUseScanner(): boolean {
  return requireOptionalNativeModule('ExpoCamera') != null;
}
