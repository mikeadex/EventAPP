/**
 * Dynamic loaders for ESM-only dependencies.
 *
 * Deliberately a plain `.js` file outside `src/`, because two constraints have
 * to hold simultaneously and each one breaks the obvious fix for the other:
 *
 *  1. `tsc` with `module: commonjs` rewrites `await import(x)` into
 *     `require(x)`. Written in TypeScript, these would compile straight back
 *     into the `require()` of an ES module that fails at runtime with
 *     ERR_REQUIRE_ESM. Living outside `src/`, this file is never compiled — it
 *     ships exactly as authored.
 *
 *  2. Vercel's file tracer decides what to bundle into the function by reading
 *     static import/require specifiers. Hiding the import behind
 *     `new Function('s', 'return import(s)')` satisfied constraint 1 but made
 *     the specifier invisible, so better-auth was omitted from the deployment
 *     entirely and every auth request 500'd. The literal strings below are what
 *     the tracer needs to see.
 *
 * Keep the specifiers as plain literals. Anything computed defeats point 2.
 */

exports.loadBetterAuth = () => import('better-auth');
exports.loadBetterAuthPrismaAdapter = () => import('better-auth/adapters/prisma');
exports.loadBetterAuthPlugins = () => import('better-auth/plugins');
