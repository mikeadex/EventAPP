import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

interface ZodIssueLike {
  path: (string | number)[];
  code: string;
  message: string;
}

interface ZodErrorLike {
  issues: ZodIssueLike[];
}

function isZodError(err: unknown): err is ZodErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'ZodError' &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

/**
 * Matches ZodErrors by *shape* rather than by class identity.
 *
 * `@Catch(ZodError)` looks correct but silently misses half the API. Nest
 * selects a filter with `exception instanceof Metatype`, and this workspace
 * resolves two separate copies of zod — `apps/api/node_modules/zod` and
 * `packages/shared/node_modules/zod` (same version, distinct instances,
 * because the root hoists a different major). Schemas defined in
 * `@ekklesia/shared` — CreateEvent, UpdateEvent, CreateOrganization, Rsvp,
 * EventSearch and the rest — therefore threw a ZodError the filter did not
 * recognise, and every one of those endpoints answered invalid input with a
 * bare 500 instead of a 400 naming the bad field. `GET /v1/events?limit=abc`
 * returned 500 in production.
 *
 * `instanceof` consults `Symbol.hasInstance`, so a structural check plugs
 * straight into Nest's matching and stays correct however the dependency tree
 * is deduped later.
 */
const ZodErrorLike = class {
  static [Symbol.hasInstance](err: unknown): boolean {
    return isZodError(err);
  }
} as unknown as new () => ZodErrorLike;

@Catch(ZodErrorLike)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodErrorLike, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(HttpStatus.BAD_REQUEST).json({
      statusCode: 400,
      error: 'ValidationError',
      message: 'Request failed validation',
      issues: exception.issues.map((i) => ({
        path: i.path.join('.'),
        code: i.code,
        message: i.message,
      })),
    });
  }
}
