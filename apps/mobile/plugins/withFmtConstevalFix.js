// Expo config plugin: makes the fmt/consteval fix durable.
//
// React Native 0.76 bundles fmt 11.0.2, which unconditionally enables a
// `consteval` compile-time format-string check that Xcode 16+/26's clang
// rejects ("call to consteval function … is not a constant expression").
// fmt is cloned from GitHub by CocoaPods into Pods/fmt (not node_modules), so
// patch-package can't touch it. Instead we inject a Podfile post_install step
// that neutralizes the `consteval` keyword in fmt's base.h after pods install.
//
// This re-applies automatically on every `expo prebuild` + `pod install`, so it
// survives `expo prebuild --clean` and a fresh `pod install`.

const fs = require('fs');
const path = require('path');

// Resolve @expo/config-plugins via expo's install (robust under pnpm).
const { withDangerousMod } = require(
  require.resolve('@expo/config-plugins', {
    paths: [path.dirname(require.resolve('expo/package.json'))],
  }),
);

const MARKER = '# [ekklesia] fmt-consteval-fix';

const PATCH_RUBY = `
    ${MARKER} — neutralize fmt consteval (Xcode 16+/26 clang)
    fmt_base = File.join(installer.sandbox.root, 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      original = File.read(fmt_base)
      patched = original.gsub(
        '#  define FMT_CONSTEVAL consteval',
        '#  define FMT_CONSTEVAL /* disabled for Xcode 16+/26 clang */'
      )
      File.write(fmt_base, patched) if patched != original
    end
`;

module.exports = function withFmtConstevalFix(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes(MARKER)) {
        // Insert right after the post_install block opens.
        contents = contents.replace(
          /post_install do \|installer\|\n/,
          (match) => match + PATCH_RUBY + '\n',
        );
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
};
