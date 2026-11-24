import {
  Body,
  Controller,
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
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { RequirePlatformRole } from '../../common/decorators.js';
import { PlatformRoleGuard, type PlatformRequest } from '../../common/platform-role.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ClaimsModule } from '../claims/claims.module.js';
import { EventsModule } from '../events/events.module.js';
import { AdminEventsService } from './admin-events.service.js';
import { AdminHostsService } from './admin-hosts.service.js';
import { AdminReportsService } from './admin-reports.service.js';

/**
 * Platform admin endpoints.
 *
 * Gated at the class level so a handler added later is protected by default;
 * the guard also refuses any handler with no role declared, so the two cannot
 * drift apart.
 */
@Controller('admin')
@UseGuards(PlatformRoleGuard)
@RequirePlatformRole('PLATFORM_MODERATOR')
export class AdminController {
  constructor(
    private readonly reports: AdminReportsService,
    private readonly hosts: AdminHostsService,
    private readonly events: AdminEventsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Who is signed in to the console. The web layout calls this first: the
   * guard's 401/403 (and its NEEDS_2FA / WRONG_DOMAIN codes) decide whether
   * the shell renders at all. Lowest staff gate, so every staff role can
   * reach the console even where its screens are hidden from them.
   */
  @Get('me')
  @RequirePlatformRole('PLATFORM_SUPPORT')
  async me(@Req() req: PlatformRequest) {
    const row = await this.prisma.user.findUnique({
      where: { id: req.user.id },
      select: { name: true },
    });
    return {
      id: req.user.id,
      name: row?.name ?? null,
      email: req.user.email,
      platformRole: req.user.platformRole,
    };
  }

  @Get('reports')
  list(@Query('status') status?: string) {
    return this.reports.list(status);
  }

  @Get('reports/counts')
  counts() {
    return this.reports.counts();
  }

  @Post('reports/:reportId/review')
  review(@Req() req: PlatformRequest, @Param('reportId') reportId: string) {
    return this.reports.startReview(req.user.id, reportId);
  }

  @Post('reports/:reportId/resolve')
  resolve(
    @Req() req: PlatformRequest,
    @Param('reportId') reportId: string,
    @Body() body: { action?: unknown; note?: unknown },
  ) {
    return this.reports.resolve(req.user.id, reportId, body);
  }

  // ─── Hosts ───────────────────────────────────────────────────────────────

  @Get('hosts')
  @RequirePlatformRole('PLATFORM_SUPPORT')
  listHosts(@Query() query: unknown) {
    return this.hosts.list(query);
  }

  /** Possible duplicates while adding a church. Declared before `hosts/:id`. */
  @Get('hosts/match')
  matchHosts(@Query() query: unknown) {
    return this.hosts.match(query);
  }

  @Get('hosts/:id')
  @RequirePlatformRole('PLATFORM_SUPPORT')
  getHost(@Param('id') id: string) {
    return this.hosts.get(id);
  }

  @Post('hosts')
  createHost(@Req() req: PlatformRequest, @Body() body: unknown) {
    return this.hosts.create(req.user.id, body, req);
  }

  @Post('hosts/:id/events')
  addHostEvent(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.hosts.addEvent(id, req.user.id, body, req);
  }

  @Post('hosts/:id/resend')
  @HttpCode(200)
  resendInvite(@Req() req: PlatformRequest, @Param('id') id: string) {
    return this.hosts.resend(id, req.user.id, req);
  }

  @Patch('hosts/:id/contact')
  changeContact(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.hosts.changeContact(id, req.user.id, body, req);
  }

  @Post('hosts/:id/restore')
  @HttpCode(200)
  restoreHost(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.hosts.restore(id, req.user.id, body, req);
  }

  // ─── Events ──────────────────────────────────────────────────────────────

  @Get('events')
  @RequirePlatformRole('PLATFORM_SUPPORT')
  listEvents(@Query() query: unknown) {
    return this.events.list(query);
  }

  @Post('events/:id/unpublish')
  @HttpCode(200)
  unpublishEvent(@Req() req: PlatformRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.events.unpublish(id, req.user.id, body, req);
  }
}

@Module({
  imports: [AuthModule, EventsModule, ClaimsModule],
  controllers: [AdminController],
  providers: [
    PrismaService,
    AuditLogService,
    AdminReportsService,
    AdminHostsService,
    AdminEventsService,
    PlatformRoleGuard,
  ],
})
export class AdminModule {}
