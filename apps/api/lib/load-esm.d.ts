/**
 * Types for `load-esm.js`. The implementation is hand-written JavaScript that
 * `tsc` must not compile — see the comment there for why.
 */
export declare function loadBetterAuth(): Promise<typeof import('better-auth')>;
export declare function loadBetterAuthPrismaAdapter(): Promise<
  typeof import('better-auth/adapters/prisma')
>;
export declare function loadBetterAuthPlugins(): Promise<typeof import('better-auth/plugins')>;
