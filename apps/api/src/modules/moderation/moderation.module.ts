import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditLogService } from '../../common/audit-log.service.js';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { ModerationService } from './moderation.service.js';

/**
 * Reporting content, and blocking whoever posted it.
 *
 * Both require a signed-in account: an anonymous report cannot be followed up
 * and is trivially floodable, and a block has to belong to somebody.
 */
@Controller()
@UseGuards(AuthGuard)
class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Post('reports')
  createReport(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.moderation.createReport(req.user.id, body);
  }

  @Get('me/blocks')
  listBlocks(@Req() req: AuthedRequest) {
    return this.moderation.listBlocks(req.user.id);
  }

  @Post('me/blocks')
  createBlock(@Req() req: AuthedRequest, @Body() body: unknown) {
    return this.moderation.createBlock(req.user.id, body);
  }

  @Delete('me/blocks/:blockId')
  @HttpCode(204)
  removeBlock(@Req() req: AuthedRequest, @Param('blockId') blockId: string) {
    return this.moderation.removeBlock(req.user.id, blockId);
  }
}

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [ModerationController],
  providers: [PrismaService, AuditLogService, ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
