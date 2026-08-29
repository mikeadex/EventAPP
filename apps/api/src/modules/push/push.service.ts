import { Injectable, Logger } from '@nestjs/common';
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
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
 * Modelled on EmailService in one important way: a failure here never
 * propagates. The caller has already committed the thing the user asked for —
 * the RSVP is booked, the announcement is saved — and failing that because a
 * notification could not be delivered would be the wrong trade every time.
 *
 * Expo answers in two stages. The immediate ticket says whether it accepted the
 * message; a receipt, fetched later, says whether the device actually got it.
 * We act on the ticket only. `DeviceNotRegistered` is the one that matters
 * there: it means the app was uninstalled or the token rotated, and continuing
 * to send would pile up failures forever, so the row is disabled rather than
 * deleted — keeping the history, and letting a reinstall re-register cleanly.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  // FCM v1 is the default at expo-server-sdk 7; there is no option to set.
  private readonly expo = new Expo();

  constructor(private readonly prisma: PrismaService) {}

  /** Send to every live device belonging to these users. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<{ sent: number }> {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (ids.length === 0) return { sent: 0 };

    const devices = await this.prisma.device.findMany({
      where: { userId: { in: ids }, disabledAt: null },
      select: { token: true },
    });
    if (devices.length === 0) return { sent: 0 };

    // Expo rejects the whole chunk if any token is malformed, and a bad row
    // should not silence everyone else's notification.
    const tokens = devices.map((d) => d.token).filter((t) => Expo.isExpoPushToken(t));
    if (tokens.length === 0) return { sent: 0 };

    const messages: ExpoPushMessage[] = tokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));

    let sent = 0;
    try {
      for (const chunk of this.expo.chunkPushNotifications(messages)) {
        const tickets = await this.expo.sendPushNotificationsAsync(chunk);
        sent += await this.reconcile(chunk, tickets);
      }
    } catch (err) {
      this.logger.error(`Push send failed: ${(err as Error).message}`);
    }
    return { sent };
  }

  /**
   * Match tickets back to the tokens they were for, and retire dead ones.
   * Expo returns tickets in request order, which is the only thing tying an
   * error back to a token.
   */
  private async reconcile(chunk: ExpoPushMessage[], tickets: ExpoPushTicket[]): Promise<number> {
    let ok = 0;
    const dead: string[] = [];

    tickets.forEach((ticket, i) => {
      if (ticket.status === 'ok') {
        ok += 1;
        return;
      }
      const to = chunk[i]?.to;
      const token = Array.isArray(to) ? to[0] : to;
      if (ticket.details?.error === 'DeviceNotRegistered' && token) {
        dead.push(token);
      } else {
        this.logger.warn(`Push rejected (${ticket.details?.error ?? 'unknown'}): ${ticket.message}`);
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
