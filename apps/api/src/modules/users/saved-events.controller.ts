import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthedRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('me/saved-events')
@UseGuards(AuthGuard)
export class SavedEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    return this.prisma.savedEvent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            startsAt: true,
            coverImageUrl: true,
            organization: { select: { slug: true, name: true } },
          },
        },
      },
    });
  }

  @Post(':eventId')
  @HttpCode(204)
  async save(@Param('eventId') eventId: string, @Req() req: AuthedRequest) {
    await this.prisma.savedEvent.upsert({
      where: { userId_eventId: { userId: req.user.id, eventId } },
      update: {},
      create: { userId: req.user.id, eventId },
    });
  }

  @Delete(':eventId')
  @HttpCode(204)
  async unsave(@Param('eventId') eventId: string, @Req() req: AuthedRequest) {
    await this.prisma.savedEvent.deleteMany({
      where: { userId: req.user.id, eventId },
    });
  }
}
