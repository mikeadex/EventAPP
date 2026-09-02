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
  constructor(private readonly reports: AdminReportsService) {}

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
