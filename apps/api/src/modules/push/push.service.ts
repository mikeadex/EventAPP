import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

export interface PushPayload {
  title: string;
  body: string;
  /** Routed by the app on tap; see notification handling in the mobile client. */
  data?: Record<string, string>;
}

/**
 * Sending push notifications through Expo.
 *
 * Deliberately talks to Expo over plain `fetch` rather than using
 * `expo-server-sdk`. That package is pure ESM (`"type": "module"`, no `require`
 * condition), this API compiles to CommonJS, and **Vercel's runtime rejects
 * `require()` of ESM outright** — importing it took production down with "API
 * failed to start", the same failure better-auth caused and the reason
 * `lib/load-esm.js` exists. The SDK's only real value here is chunking and a
 * token regex, both of which are a few lines, so the dependency is not worth
 * carrying past a landmine.
 *
 * A failure never propagates, matching EmailService. By the time we notify, the
 * caller has already committed what the user asked for — the RSVP is booked,
 * the announcement saved — and failing that because Expo hiccuped would be the
 * wrong trade every time.
 */
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo rejects requests larger than this. */
const CHUNK_SIZE = 100;

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Matches both token spellings Expo issues. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(token);
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Send to every live device belonging to these users. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number }> {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return { sent: 0 };

    const devices = await this.prisma.device.findMany({
      where: { userId: { in: ids }, disabledAt: null },
      select: { token: true },
    });

    // A malformed row must not take out everyone else's notification.
    const tokens = devices.map((d) => d.token).filter(isExpoPushToken);
    if (tokens.length === 0) return { sent: 0 };

    let sent = 0;
    for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
      const chunk = tokens.slice(i, i + CHUNK_SIZE);
      sent += await this.sendChunk(chunk, payload);
    }
    return { sent };
  }

  private async sendChunk(tokens: string[], payload: PushPayload): Promise<number> {
    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    let tickets: ExpoTicket[];
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.logger.error(`Expo push responded ${res.status}`);
        return 0;
      }
      const json = (await res.json()) as { data?: ExpoTicket[] };
      tickets = json.data ?? [];
    } catch (err) {
      this.logger.error(`Push send failed: ${(err as Error).message}`);
      return 0;
    }

    // Tickets come back in request order, which is the only thing tying an
    // error back to the token it was for.
    let ok = 0;
    const dead: string[] = [];
    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') {
        ok += 1;
        return;
      }
      const token = tokens[i];
      // The app was uninstalled or the token rotated. Continuing to send would
      // pile up failures forever; disabled rather than deleted so the history
      // survives and a reinstall can re-register cleanly.
      if (ticket.details?.error === 'DeviceNotRegistered' && token) {
        dead.push(token);
      } else {
        this.logger.warn(
          `Push rejected (${ticket.details?.error ?? 'unknown'}): ${ticket.message ?? ''}`,
        );
      }
    });

    if (dead.length) {
      await this.prisma.device.updateMany({
        where: { token: { in: dead } },
        data: { disabledAt: new Date() },
      });
      this.logger.log(`Disabled ${dead.length} unregistered device(s)`);
    }
    return ok;
  }
}
