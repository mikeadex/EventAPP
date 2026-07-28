// Metro config for the Ekklesia mobile app (Expo SDK 52, React Native 0.76).
//
// The one non-trivial concern is React de-duplication in a pnpm monorepo.
//
// The web/API side of this repo legitimately uses React 19 (Next.js 15,
// resend, better-auth's Next build). pnpm therefore keeps BOTH react@19 and
// react@18.3.1 in its store. The mobile app pins react@18.3.1, but it imports
// `better-auth/react`, and that better-auth instance peer-resolved its own
// React to 19. Without intervention the Metro bundle ends up containing two
// Reacts, whose element `$$typeof` symbols differ — producing the runtime
// error "Objects are not valid as a React child (found: object with keys
// {$$typeof,...})", even on a trivial screen.
//
// Fix: force every `react` and `react-dom` request (including subpath imports
// such as `react/jsx-runtime`) to resolve from the app's single 18.3.1 copy,
// regardless of which module is doing the importing. `react-native` is left to
// Metro's default resolver — there is only one copy and its platform-specific
// extension handling (.ios.js / .android.js) must be preserved.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enablePackageExports = true;

// Resolve the node_modules dir that physically contains the pinned copies.
function nodeModulesDirOf(pkgName) {
  const pkgJson = fs.realpathSync(
    require.resolve(`${pkgName}/package.json`, { paths: [projectRoot] }),
  );
  // .../node_modules/<pkg>/package.json -> .../node_modules
  return path.dirname(path.dirname(pkgJson));
}

const REACT_NM = nodeModulesDirOf('react');
let REACT_DOM_NM = null;
try {
  REACT_DOM_NM = nodeModulesDirOf('react-dom');
} catch {
  // react-dom is optional on native; only react-native-web pulls it.
}

// Project-root node_modules — used as a resolution fallback (see below).
const PROJECT_NM = path.resolve(projectRoot, 'node_modules');

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. Force a single React / React-DOM copy (see file header).
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [REACT_NM] }) };
  }
  if (REACT_DOM_NM && (moduleName === 'react-dom' || moduleName.startsWith('react-dom/'))) {
    return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [REACT_DOM_NM] }) };
  }

  // 2. Normal resolution.
  try {
    return defaultResolveRequest
      ? defaultResolveRequest(context, moduleName, platform)
      : context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    // 3. Fallback for pnpm's isolated layout: when a package buried under a
    //    deep `.pnpm/<hash>/node_modules/<pkg>` path imports a peer dependency
    //    (e.g. @better-auth/expo importing `expo-network`), Metro resolves
    //    relative to that deep path and can't walk back to the app's
    //    node_modules where the peer actually lives. Retry the bare specifier
    //    from the app root before giving up.
    const isBare = !moduleName.startsWith('.') && !moduleName.startsWith('/');
    if (isBare) {
      try {
        return { type: 'sourceFile', filePath: require.resolve(moduleName, { paths: [PROJECT_NM] }) };
      } catch {
        // fall through to original error
      }
    }
    throw err;
  }
};

module.exports = config;
