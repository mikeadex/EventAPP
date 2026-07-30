import {
  Body,
  Controller,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Permission } from '@ekklesia/shared';
import {
  OrgScope,
  RequirePermissions,
} from '../../common/decorators.js';
import {
  OrgMembershipGuard,
  type AuthedOrgRequest,
} from '../../common/org-membership.guard.js';
import { EventsService } from './events.service.js';

@Controller()
class EventsController {
  constructor(private readonly events: EventsService) {}

  // ─── Public ──────────────────────────────────────────────────────────────
  @Get('events')
  search(@Query() query: unknown) {
    return this.events.searchPublic(query);
  }

  @Get('events/cities')
  cities() {
    return this.events.listCities();
  }

  @Get('events/:eventId/attendees')
  attendees(@Param('eventId') eventId: string) {
    return this.events.listPublicAttendees(eventId);
  }

  @Get('organizations/:orgSlug/events/:eventSlug')
  getPublic(
    @Param('orgSlug') orgSlug: string,
    @Param('eventSlug') eventSlug: string,
  ) {
    return this.events.getPublicBySlug(orgSlug, eventSlug);
  }

  // ─── Organizer ───────────────────────────────────────────────────────────
  @Get('organizations/:orgId/events')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('param:orgId')
  @RequirePermissions(Permission.EVENT_READ)
  listForOrg(@Param('orgId') orgId: string) {
    return this.events.listForOrganization(orgId);
  }

  @Post('organizations/:orgId/events')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('param:orgId')
  @RequirePermissions(Permission.EVENT_CREATE)
  create(
    @Param('orgId') orgId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    return this.events.create(orgId, req.user.id, body);
  }

  @Patch('events/:eventId')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  update(
    @Param('eventId') eventId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    return this.events.update(eventId, req.user.id, body);
  }

  @Post('events/:eventId/publish')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_PUBLISH)
  publish(@Param('eventId') eventId: string, @Req() req: AuthedOrgRequest) {
    return this.events.publish(eventId, req.user.id);
  }

  @Post('events/:eventId/cancel')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_CANCEL)
  cancel(
    @Param('eventId') eventId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: { reason?: string } | undefined,
  ) {
    return this.events.cancel(eventId, req.user.id, body?.reason);
  }
}

@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
