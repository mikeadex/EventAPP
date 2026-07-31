import type { PrismaClient } from '@prisma/client';

/**
 * Retry queries that fail because the pooled connection was already dead.
 *
 * Serverless + an auto-suspending Postgres (Neon) makes this routine. Neon
 * suspends the compute after a few minutes of no traffic, which closes every
 * open connection, while the Vercel instance can stay warm holding those now
 * dead sockets in Prisma's pool. The next request borrows one and fails before
 * it ever reaches Postgres:
 *
 *   PrismaClientKnownRequestError: Server has closed the connection.
 *
 * Prisma re-establishes the connection as a side effect of that failure, so the
 * *following* query succeeds — which is exactly the reported symptom: come back
 * to the app after a while, the first load fails, and everything works on the
 * second try.
 *
 * Replaying is safe for these specific errors because the query never reached
 * the database: the socket was closed before it was written, so no write can be
 * duplicated. Errors that are not connection failures are rethrown untouched.
 */
const DEAD_CONNECTION_CODES = new Set([
  'P1001', // can't reach database server
  'P1002', // database server timed out
  'P1017', // server has closed the connection
]);

const DEAD_CONNECTION_MESSAGE =
  /server has closed the connection|can't reach database server|connection (was )?closed|connection reset|econnreset|epipe|terminating connection/i;

/** Delay before each retry. Two attempts, briefly spaced to let Neon wake. */
const RETRY_DELAYS_MS = [150, 600];

function isDeadConnection(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'string' && DEAD_CONNECTION_CODES.has(code)) return true;
  // Prisma reports the closed-socket case as a known request error whose code is
  // not one of the P100x connection codes, so fall back to matching the message.
  const message = (err as { message?: unknown }).message;
  return typeof message === 'string' && DEAD_CONNECTION_MESSAGE.test(message);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Registers the retry middleware on a client. Call once per PrismaClient, before
 * it serves any query. Applies to every model operation, including the ones
 * Better Auth issues through its Prisma adapter.
 */
export function useDeadConnectionRetry(client: PrismaClient): void {
  client.$use(async (params, next) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        return await next(params);
      } catch (err) {
        if (!isDeadConnection(err)) throw err;
        lastError = err;
        const delay = RETRY_DELAYS_MS[attempt];
        if (delay !== undefined) await sleep(delay);
      }
    }
    throw lastError;
  });
}
