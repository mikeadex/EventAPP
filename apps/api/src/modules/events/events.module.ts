import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
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
import { PushModule } from '../push/push.module.js';
import { EventMediaService } from './event-media.service.js';

@Controller()
class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly media: EventMediaService,
  ) {}

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

  @Get('events/:eventId')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_READ)
  getForOrganizer(@Param('eventId') eventId: string) {
    return this.events.getForOrganizer(eventId);
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

  /** The gallery. Public — it is part of the event page anyone can see. */
  @Get('events/:eventId/media')
  listMedia(@Param('eventId') eventId: string) {
    return this.media.list(eventId);
  }

  @Post('events/:eventId/media')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  addMedia(
    @Param('eventId') eventId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    return this.media.add(eventId, req.user.id, body);
  }

  @Patch('events/:eventId/media/reorder')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  reorderMedia(@Param('eventId') eventId: string, @Body() body: unknown) {
    return this.media.reorder(eventId, body);
  }

  @Patch('events/:eventId/media/:mediaId/cover')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  setCover(@Param('eventId') eventId: string, @Param('mediaId') mediaId: string) {
    return this.media.setCover(eventId, mediaId);
  }

  @Patch('events/:eventId/media/:mediaId')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  updateMedia(
    @Param('eventId') eventId: string,
    @Param('mediaId') mediaId: string,
    @Body() body: unknown,
  ) {
    return this.media.update(eventId, mediaId, body);
  }

  @Delete('events/:eventId/media/:mediaId')
  @HttpCode(204)
  @UseGuards(OrgMembershipGuard)
  @OrgScope('eventParam:eventId')
  @RequirePermissions(Permission.EVENT_UPDATE)
  removeMedia(
    @Param('eventId') eventId: string,
    @Param('mediaId') mediaId: string,
    @Req() req: AuthedOrgRequest,
  ) {
    return this.media.remove(eventId, mediaId, req.user.id);
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
  imports: [PushModule],
  controllers: [EventsController],
  providers: [EventsService, EventMediaService],
  exports: [EventsService],
})
export class EventsModule {}
