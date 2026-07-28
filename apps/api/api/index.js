/**
 * Vercel serverless entrypoint for the NestJS API.
 *
 * Deliberately plain JavaScript that requires the *already compiled* `dist/`
 * output rather than TypeScript source. Vercel builds files under `api/` with
 * esbuild, and esbuild does not emit the `design:paramtypes` decorator metadata
 * that Nest's dependency injection relies on — compiling the app itself with
 * esbuild would break DI at runtime. `nest build` (tsc, emitDecoratorMetadata)
 * runs first via the buildCommand in vercel.json, so everything under dist/
 * already has its metadata baked in. This file has no decorators of its own,
 * so esbuild handling it is harmless.
 *
 * The bootstrapped Express app is cached on the module scope. Vercel reuses a
 * warm instance across invocations, so the ~1-2s Nest DI container build is
 * paid on cold start only.
 */
require('reflect-metadata');

let cached = null;

async function bootstrap() {
  // Everything below is required lazily, from inside the handler's try block.
  //
  // Requiring the compiled app graph is NOT side-effect free: modules/auth.ts
  // constructs PrismaClient, EmailService and betterAuth() at module scope, so
  // the import itself throws when BETTER_AUTH_SECRET or DATABASE_URL is absent.
  // A top-level require would therefore crash the function before the handler
  // existed, and Vercel would report an opaque FUNCTION_INVOCATION_FAILED with
  // our error handling never given a chance to run.
  //
  // bootstrap.js is safe to load first — pipes and filters only, no side effects.
  const { configureApp, assertRequiredEnv } = require('../dist/bootstrap.js');

  let NestFactory;
  let AppModule;
  try {
    ({ NestFactory } = require('@nestjs/core'));
    ({ AppModule } = require('../dist/app.module.js'));
  } catch (err) {
    // Missing configuration is overwhelmingly the reason this import fails, so
    // name the offending variables rather than surfacing whichever constructor
    // happened to throw first.
    assertRequiredEnv();
    throw err;
  }

  // Validate only *after* the import: loading the graph is also what populates
  // process.env from a local .env file (via ConfigModule / Prisma). Checking
  // beforehand would wrongly report every variable as missing in local dev,
  // where config comes from the file rather than the environment.
  assertRequiredEnv();

  // No explicit ExpressAdapter: Nest defaults to Express and builds its own
  // instance, which we then hand to Vercel. Requiring `express` directly here
  // would fail under pnpm's isolated node_modules (it's a transitive dep of
  // @nestjs/platform-express, not a direct one) and risks a version mismatch.
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    // Stripe webhook signature verification needs the unparsed body.
    rawBody: true,
  });
  configureApp(app);
  await app.init();
  return app.getHttpAdapter().getInstance();
}

module.exports = async function handler(req, res) {
  try {
    // Cache the promise, not the resolved app, so concurrent cold-start
    // requests share a single bootstrap instead of each building their own.
    if (!cached) cached = bootstrap();
    const app = await cached;
    return app(req, res);
  } catch (err) {
    // Clear the cache so a failed bootstrap doesn't poison this warm instance
    // for every subsequent request — a transient DB blip on cold start would
    // otherwise persist until the next deploy.
    cached = null;
    // Log the real cause (visible in `vercel logs`) but don't leak internals
    // to the caller.
    console.error('[bootstrap] API failed to start:', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    return res.end(
      JSON.stringify({ statusCode: 500, message: 'API failed to start. See server logs.' }),
    );
  }
};
