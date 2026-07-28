import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { ZodExceptionFilter } from './common/zod-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

  app.use(helmet());
  app.enableCors({
    origin: (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });
  // Routes excluded from the /v1 prefix:
  //  - /health  (operational probe)
  //  - /webhooks/*  (third-party callbacks expect stable paths)
  //  - /auth/*  (Better Auth mounts its own router at /auth/*)
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'webhooks/(.*)', 'auth/(.*)'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ZodExceptionFilter());

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
