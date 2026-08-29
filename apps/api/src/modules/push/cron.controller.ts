import { Controller, ForbiddenException, Get, Headers, Logger } from '@nestjs/common';
import { RemindersService } from './reminders.service.js';

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

  constructor(private readonly reminders: RemindersService) {}

  @Get('reminders')
  async reminders_(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      this.logger.error('CRON_SECRET is not set — refusing to run the reminder job');
      throw new ForbiddenException('Cron is not configured');
    }
    if (authorization !== `Bearer ${secret}`) {
      throw new ForbiddenException('Invalid cron credentials');
    }
    return this.reminders.runDue();
  }
}
