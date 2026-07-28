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

const { NestFactory } = require('@nestjs/core');

const { AppModule } = require('../dist/app.module.js');
const { configureApp } = require('../dist/bootstrap.js');

let cached = null;

async function bootstrap() {
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
  // Cache the promise, not the resolved app, so concurrent cold-start requests
  // share a single bootstrap instead of each building their own container.
  if (!cached) cached = bootstrap();
  const app = await cached;
  return app(req, res);
};
