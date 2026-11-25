import { Controller, ForbiddenException, Get, Headers, Logger } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';
import { OrdersService } from '../payments/orders.service.js';
import { SeriesService } from '../events/series.service.js';

/**
 * Endpoints driven by Vercel Cron rather than by a user.
 *
 * Guarded by a shared secret, not by AuthGuard — there is no session behind a
 * cron invocation. Vercel sends `Authorization: Bearer $CRON_SECRET` when that
 * variable is set on the project. Without the guard this is a public button
 * that makes the app send notifications, which anyone who reads the routes
 * could hold down.
 *
 * Refuses to run at all when CRON_SECRET is unset. Failing closed is the only
 * safe default: the alternative is that forgetting to set one variable quietly
 * publishes the endpoint to the internet.
 */
@Controller('cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly reminders: RemindersService,
    private readonly orders: OrdersService,
    private readonly series: SeriesService,
  ) {}

  /** Shared secret check. Fails closed when CRON_SECRET is unset. */
  private assertCron(authorization: string | undefined, job: string): void {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      this.logger.error(`CRON_SECRET is not set — refusing to run the ${job} job`);
      throw new ForbiddenException('Cron is not configured');
    }
    if (authorization !== `Bearer ${secret}`) {
      throw new ForbiddenException('Invalid cron credentials');
    }
  }

  /**
   * Hand back inventory from checkouts that were never paid for.
   *
   * Without this an abandoned order holds its seats until the event itself
   * passes, so a popular event reads as sold out with nobody coming. Runs
   * every five minutes against a fifteen-minute reservation window, which
   * means a released seat is back on sale well inside the window it was held
   * for, and the sweep is cheap enough to run that often.
   */
  @Get('release-expired-orders')
  async releaseExpiredOrders(@Headers('authorization') authorization?: string) {
    this.assertCron(authorization, 'order release');
    const released = await this.orders.releaseExpired();
    return { released };
  }

  /**
   * Move each series' discovery slot to its next occurrence, and extend
   * series running out of generated dates.
   *
   * Without the first, a repeating event drops out of discovery the moment
   * its current occurrence starts and never comes back. Without the second,
   * an open-ended weekly service quietly stops having dates about six months
   * in. Hourly is enough for both: the lead only needs to move once per
   * occurrence, and the horizon is extended a month before it runs out.
   */
  @Get('roll-series')
  async rollSeries(@Headers('authorization') authorization?: string) {
    this.assertCron(authorization, 'series roll');
    return this.series.rollLeads();
  }

  @Get('reminders')
  async reminders_(@Headers('authorization') authorization?: string) {
    this.assertCron(authorization, 'reminder');
    return this.reminders.runDue();
  }
}
