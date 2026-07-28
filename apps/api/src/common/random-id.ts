import { randomBytes } from 'node:crypto';

/**
 * Random identifier generation, using Node's built-in CSPRNG.
 *
 * This replaces `nanoid`, which from v5 is published as pure ESM with no
 * `require` export condition. A CommonJS build can only reach it through a
 * dynamic import, and Vercel's runtime rejects `require()` of ESM outright
 * (ERR_REQUIRE_ESM). Since every use here is "give me N random characters",
 * depending on a package for it bought nothing and cost a deploy blocker.
 */

// Unambiguous URL/filename-safe alphabet. 62 characters, so a raw `byte % 62`
// would be biased toward the first few — the sampling below avoids that.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const MASK = 63; // 2^6 - 1, the smallest mask covering ALPHABET.length

/**
 * Cryptographically random string of `size` characters, uniformly distributed.
 *
 * Uses rejection sampling: each byte is masked to 6 bits and discarded when it
 * lands outside the alphabet (values 62 and 63), which keeps every character
 * equally likely rather than skewing toward 'A'/'B'.
 */
export function randomId(size: number): string {
  let out = '';
  while (out.length < size) {
    // Over-request slightly so the common case needs a single syscall even
    // when a few bytes are rejected.
    for (const byte of randomBytes(size + 8)) {
      const index = byte & MASK;
      if (index < ALPHABET.length) {
        out += ALPHABET[index];
        if (out.length === size) break;
      }
    }
  }
  return out;
}
