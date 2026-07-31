import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Permission } from '@ekklesia/shared';
import { OrgScope, RequirePermissions } from '../../common/decorators.js';
import {
  OrgMembershipGuard,
  type AuthedOrgRequest,
} from '../../common/org-membership.guard.js';
import { TicketTypesService } from './ticket-types.service.js';

/**
 * Routes are nested under the event so `@OrgScope('eventParam:eventId')`
 * resolves the owning organisation from a path parameter that is already
 * there — a top-level /ticket-types/:id would need a new scope resolver.
 */
@Controller()
@UseGuards(OrgMembershipGuard)
@OrgScope('eventParam:eventId')
class TicketTypesController {
  constructor(private readonly ticketTypes: TicketTypesService) {}

  @Get('events/:eventId/ticket-types')
  @RequirePermissions(Permission.EVENT_READ)
  list(@Param('eventId') eventId: string) {
    return this.ticketTypes.list(eventId);
  }

  @Post('events/:eventId/ticket-types')
  @RequirePermissions(Permission.EVENT_UPDATE)
  create(
    @Param('eventId') eventId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    return this.ticketTypes.create(eventId, req.user.id, body);
  }

  @Patch('events/:eventId/ticket-types/:ticketTypeId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  update(
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    return this.ticketTypes.update(eventId, ticketTypeId, req.user.id, body);
  }

  @Delete('events/:eventId/ticket-types/:ticketTypeId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  remove(
    @Param('eventId') eventId: string,
    @Param('ticketTypeId') ticketTypeId: string,
    @Req() req: AuthedOrgRequest,
  ) {
    return this.ticketTypes.remove(eventId, ticketTypeId, req.user.id);
  }
}

@Module({
  controllers: [TicketTypesController],
  providers: [TicketTypesService],
  exports: [TicketTypesService],
})
export class TicketTypesModule {}
