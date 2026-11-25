// Expo config plugin: raise EVERY pod target to the iOS deployment floor.
//
// `expo-build-properties`' `ios.deploymentTarget` sets the Podfile platform
// and most pod targets — 242 of them here — but leaves resource-bundle
// targets at whatever their own podspec declares. Eighteen of those sat at
// 12.0–13.4 (most of the Stripe SDK's bundles, AsyncStorage's resources,
// ReachabilitySwift), and EAS's Xcode rejects anything below 15.0:
//
//   The iOS deployment target 'IPHONEOS_DEPLOYMENT_TARGET' is set to 13.0,
//   but the range of supported deployment target versions is 15.0 to 27.1.x
//   (in target 'StripePayments-Stripe3DS2' from project 'Pods')
//
// That killed two production builds. It does not reproduce locally because
// the simulator builds here run an older toolchain that still accepts 13.0.
//
// The patch goes at the END of post_install, inside the loop the Expo
// template already runs over resource bundles, for two reasons: those are
// precisely the targets that are wrong, and `react_native_post_install` runs
// earlier in the same block — anything written before it can be overwritten.
//
// `ios/` is gitignored and regenerated, so this has to be a plugin; editing
// the Podfile by hand would not survive the next prebuild.

const fs = require('fs');
const path = require('path');

const { withDangerousMod } = require('@expo/config-plugins');

const MARKER = '# [ekklesia] ios-deployment-floor';

/** Keep in step with `expo-build-properties`' ios.deploymentTarget in app.json. */
const FLOOR = '15.1';

// Anchored on the one line the Expo template writes inside the resource-bundle
// loop. A single distinctive line is the least fragile thing to match — the
// surrounding block's indentation and wrapping have changed between templates.
const ANCHOR = "config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'";

// ASCII only, deliberately. A non-UTF-8 terminal makes CocoaPods blow up on a
// non-ASCII byte in the Podfile *while writing its own error report*, which
// buries the real failure under an Encoding::CompatibilityError backtrace.
// (The fmt plugin's comment has an em dash and is fine on EAS, but it cost a
// debugging cycle locally; no reason to add a second one.)
const PATCH_RUBY = `config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
          ${MARKER}: resource bundles keep their podspec's own target otherwise
          floor = '${FLOOR}'
          current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_s
          if current.empty? || current.to_f < floor.to_f
            config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = floor
          end`;

module.exports = function withIosDeploymentFloor(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) return cfg;

      if (!contents.includes(ANCHOR)) {
        // Loud rather than silent: a quietly skipped patch here means a
        // production build that fails forty minutes later with an error that
        // says nothing about this plugin.
        throw new Error(
          '[withIosDeploymentFloor] Could not find the resource-bundle loop in the Podfile. ' +
            'The Expo template changed — update ANCHOR in plugins/withIosDeploymentFloor.js.',
        );
      }

      fs.writeFileSync(podfilePath, contents.replace(ANCHOR, PATCH_RUBY));
      return cfg;
    },
  ]);
};
