import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PushService } from './push.service.js';

/**
 * "Starts in a couple of hours" reminders.
 *
 * The only trigger here that fires on a clock rather than on someone's action,
 * which makes it the only one needing a scheduler — see the cron entry in
 * vercel.json.
 *
 * Two properties matter, and they pull against each other. The job must be
 * at-least-once, because a cron invocation can time out or be interrupted
 * mid-run and the reminder still needs to go. But a person must be notified
 * once, not once per attempt — so every send is recorded in NotificationLog
 * under a unique (user, event, kind), and a collision means somebody already
 * did it. That makes the job safely re-runnable, including concurrently.
 */
export const REMINDER_KIND = 'event.reminder';
/** How far ahead to look. Paired with the cron interval — see runDue(). */
const WINDOW_HOURS = 2;

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /**
   * Notify about events starting inside the window.
   *
   * The window is deliberately wider than the cron interval. If they matched
   * exactly, a single late or skipped invocation would drop reminders on the
   * floor with no way to catch up; overlapping windows mean the next run picks
   * up whatever the last one missed, and NotificationLog stops that becoming a
   * duplicate.
   */
  async runDue(): Promise<{ events: number; notified: number }> {
    const now = new Date();
    const until = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

    const events = await this.prisma.event.findMany({
      where: {
        status: 'PUBLISHED',
        startsAt: { gt: now, lte: until },
      },
      select: { id: true, title: true, startsAt: true },
    });
    if (events.length === 0) return { events: 0, notified: 0 };

    let notified = 0;
    for (const event of events) {
      notified += await this.remindOne(event.id, event.title);
    }
    if (notified > 0) {
      this.logger.log(`Reminded ${notified} attendee(s) across ${events.length} event(s)`);
    }
    return { events: events.length, notified };
  }

  private async remindOne(eventId: string, title: string): Promise<number> {
    const holders = await this.prisma.ticket.findMany({
      where: { eventId, status: { in: ['RESERVED', 'ISSUED'] } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const userIds = holders.map((t) => t.userId).filter((id): id is string => !!id);
    if (userIds.length === 0) return 0;

    // Already-reminded people are filtered out before sending rather than after,
    // so a partial failure later cannot un-record a notification that went.
    const already = await this.prisma.notificationLog.findMany({
      where: { eventId, kind: REMINDER_KIND, userId: { in: userIds } },
      select: { userId: true },
    });
    const seen = new Set(already.map((r) => r.userId));
    const targets = userIds.filter((id) => !seen.has(id));
    if (targets.length === 0) return 0;

    // Claim first, send second. The other order would let two overlapping runs
    // both send before either recorded it — the exact duplicate this exists to
    // prevent. skipDuplicates makes the claim itself the race winner.
    const claimed = await this.prisma.notificationLog.createMany({
      data: targets.map((userId) => ({ userId, eventId, kind: REMINDER_KIND })),
      skipDuplicates: true,
    });
    if (claimed.count === 0) return 0;

    await this.push.sendToUsers(targets, {
      title,
      body: 'Starting soon',
      data: { type: 'event', eventId },
    });
    return targets.length;
  }
}
