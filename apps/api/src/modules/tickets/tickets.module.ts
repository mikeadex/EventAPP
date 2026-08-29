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
import { Permission } from '@ekklesia/shared';
import { AuthGuard } from '../auth/auth.guard.js';
import { PushModule } from '../push/push.module.js';
import type { AuthedRequest } from '../auth/auth.guard.js';
import { OrgScope, RequirePermissions } from '../../common/decorators.js';
import {
  OrgMembershipGuard,
  type AuthedOrgRequest,
} from '../../common/org-membership.guard.js';
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

  // ─── Organiser ───────────────────────────────────────────────────────────

  /** The host's own attendee list — everyone holding a ticket, not just opt-ins. */
  @Get('events/:eventId/tickets')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.TICKET_VIEW_ATTENDEES)
  listAttendees(@Param('eventId') eventId: string) {
    return this.tickets.listForEvent(eventId);
  }

  /** Message everyone holding a ticket for this event. */
  @Post('events/:eventId/announce')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  // EVENT_UPDATE rather than a check-in permission: door staff hold
  // TICKET_CHECK_IN, and being able to admit people should not imply being
  // able to push a message to every attendee.
  @RequirePermissions(Permission.EVENT_UPDATE)
  announce(
    @Param('eventId') eventId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    return this.tickets.announce(eventId, req.user.id, body);
  }

  /** Admit a ticket at the door by its code. */
  @Post('events/:eventId/check-in')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.TICKET_CHECK_IN)
  checkIn(
    @Param('eventId') eventId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    const code = (body as { code?: unknown } | null)?.code;
    if (typeof code !== 'string' || !code.trim()) {
      throw new BadRequestException('code must be a non-empty string');
    }
    return this.tickets.checkIn(eventId, req.user.id, code);
  }
}

@Module({
  imports: [PushModule],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService],
})
export class TicketsModule {}

// Suppress unused-import warning for `Request` (kept available for future
// raw-request needs without re-importing).
void (null as Request | null);
