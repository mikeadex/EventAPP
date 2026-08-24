import { ValidationPipe, type INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import { ZodExceptionFilter } from './common/zod-exception.filter.js';

export { assertRequiredEnv } from './env.js';

/**
 * Middleware, pipes and filters shared by both entrypoints:
 *
 *   - `src/main.ts`  — long-running server, used in local dev and any
 *                      container/VM deployment.
 *   - `api/index.js` — Vercel serverless handler.
 *
 * Keeping the configuration here means the two can't drift apart: a security
 * header or validation rule added for local dev is automatically applied in
 * production too.
 */
export function configureApp(app: INestApplication): void {
  app.use(helmet());
  app.enableCors({
    origin: (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
    credentials: true,
  });
  // Routes excluded from the /v1 prefix:
  //  - /health  (operational probe)
  //  - /webhooks/*  (third-party callbacks expect stable paths)
  //  - /auth/*  (Better Auth mounts its own router at /auth/*)
  //  - /.well-known/*  (Apple fetches its domain-association file from the
  //    domain root and will not follow a prefix)
  app.setGlobalPrefix('v1', {
    exclude: ['health', 'webhooks/(.*)', 'auth/(.*)', '.well-known/(.*)'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new ZodExceptionFilter());
}
