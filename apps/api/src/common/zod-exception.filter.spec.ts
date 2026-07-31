import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants';
import type { ArgumentsHost, Type } from '@nestjs/common';
import { z } from 'zod';
import { ZodExceptionFilter } from './zod-exception.filter.js';

/**
 * True when Nest would route `err` to this filter. Nest selects a filter with
 * `exception instanceof Metatype`, so replicating that here tests the actual
 * routing rule rather than a reimplementation of it.
 */
function routesToFilter(err: unknown): boolean {
  const metatypes: unknown[] =
    Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, ZodExceptionFilter) ?? [];
  return metatypes.some((Matcher) => err instanceof (Matcher as Type<unknown>));
}

function mockHost() {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const host = { switchToHttp: () => ({ getResponse: () => res }) } as unknown as ArgumentsHost;
  return { res, host };
}

describe('ZodExceptionFilter', () => {
  it('routes a ZodError thrown by this package’s zod', () => {
    const parsed = z.object({ limit: z.number() }).safeParse({ limit: 'abc' });
    expect(parsed.success).toBe(false);
    expect(routesToFilter((parsed as { error: unknown }).error)).toBe(true);
  });

  it('routes a ZodError thrown by a *different* copy of zod', () => {
    // packages/shared resolves its own zod install, so schemas defined there
    // throw an error whose class is not identical to ours. `@Catch(ZodError)`
    // missed exactly these, and every endpoint using a shared schema answered
    // invalid input with a 500 instead of a 400 naming the bad field.
    const foreign = Object.assign(new Error('Invalid input'), {
      name: 'ZodError',
      issues: [{ path: ['limit'], code: 'invalid_type', message: 'Expected number' }],
    });
    expect(routesToFilter(foreign)).toBe(true);
  });

  it('does not swallow ordinary errors, so 404s and 401s still surface', () => {
    expect(routesToFilter(new Error('boom'))).toBe(false);
    expect(routesToFilter({ name: 'ZodError' })).toBe(false); // no issues array
    expect(routesToFilter({ issues: [] })).toBe(false); // wrong name
    expect(routesToFilter(null)).toBe(false);
  });

  it('responds 400 with the offending field paths', () => {
    const { res, host } = mockHost();
    new ZodExceptionFilter().catch(
      { issues: [{ path: ['venue', 'city'], code: 'invalid_type', message: 'Required' }] },
      host,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        error: 'ValidationError',
        issues: [{ path: 'venue.city', code: 'invalid_type', message: 'Required' }],
      }),
    );
  });
});
