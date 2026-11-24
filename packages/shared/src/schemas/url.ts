import { z } from 'zod';

/**
 * A link that people will open: http or https only.
 *
 * `z.string().url()` accepts any scheme, so `javascript:alert(1)` passed as an
 * event's stream link or a host's website and was rendered as a clickable
 * link. Clients already insist on http(s) before sending (mobile's event and
 * organisation forms, and the web forms), so this rejects nothing a current
 * client sends; it closes the API to anything else.
 */
export const httpUrl = () =>
  z
    .string()
    .url()
    .refine(
      (v) => {
        try {
          const { protocol } = new URL(v);
          return protocol === 'https:' || protocol === 'http:';
        } catch {
          return false;
        }
      },
      { message: 'Use a link starting with https:// or http://' },
    );
