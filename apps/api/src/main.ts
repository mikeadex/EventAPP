import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { assertRequiredEnv, configureApp } from './bootstrap.js';

/**
 * Long-running server entrypoint — local dev, containers, VMs.
 * The Vercel serverless deployment uses `api/index.js` instead; both share
 * `configureApp` so their middleware can't drift.
 */
async function bootstrap() {
  assertRequiredEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  configureApp(app);

  // NOTE: Swagger UI is intentionally not mounted in dev right now — tsx
  // (esbuild) doesn't emit TS `design:paramtypes` metadata, which
  // @nestjs/swagger needs to introspect controllers. We'll re-enable once we
  // switch the API build to SWC (which does emit decorator metadata).

  const port = Number(process.env.API_PORT ?? 4000);
  // Bind 0.0.0.0 so simulators on the LAN IP and the Android emulator's
  // 10.0.2.2 alias can reach the dev API. Localhost-only bind would block both.
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on http://0.0.0.0:${port}`);
}
bootstrap();
