import {
  Body,
  Controller,
  Get,
  Module,
  Param,
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
class AdminController {
  constructor(
    private readonly reports: AdminReportsService,
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
}

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [PrismaService, AuditLogService, AdminReportsService, PlatformRoleGuard],
})
export class AdminModule {}
