import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthedRequest } from '../auth/auth.guard.js';
import { TicketsService } from './tickets.service.js';

@Controller()
class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /**
   * Free RSVP — issues a ticket for the calling user. Paid events use the
   * /v1/orders + /v1/payments flow added in Phase 4.
   */
  @Post('events/:eventId/rsvp')
  @UseGuards(AuthGuard)
  rsvp(
    @Param('eventId') eventId: string,
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    return this.tickets.rsvp(eventId, req.user.id, body);
  }

  @Get('me/tickets')
  @UseGuards(AuthGuard)
  myTickets(@Req() req: AuthedRequest) {
    return this.tickets.listForUser(req.user.id);
  }

  @Get('tickets/:ticketId')
  @UseGuards(AuthGuard)
  getTicket(@Param('ticketId') ticketId: string, @Req() req: AuthedRequest) {
    return this.tickets.getForUser(req.user.id, ticketId);
  }

  @Delete('tickets/:ticketId')
  @UseGuards(AuthGuard)
  cancelTicket(@Param('ticketId') ticketId: string, @Req() req: AuthedRequest) {
    return this.tickets.cancelRsvp(req.user.id, ticketId);
  }

  /** Opt in/out of the event's public "who's going" list. */
  @Patch('tickets/:ticketId/visibility')
  @UseGuards(AuthGuard)
  setVisibility(
    @Param('ticketId') ticketId: string,
    @Req() req: AuthedRequest,
    @Body() body: unknown,
  ) {
    const show = (body as { showAsAttending?: unknown } | null)?.showAsAttending;
    if (typeof show !== 'boolean') {
      throw new BadRequestException('showAsAttending must be a boolean');
    }
    return this.tickets.setVisibility(req.user.id, ticketId, show);
  }
}

@Module({
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}

// Suppress unused-import warning for `Request` (kept available for future
// raw-request needs without re-importing).
void (null as Request | null);
