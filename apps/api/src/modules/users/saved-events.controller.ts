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
import { EVENT_CARD_SELECT, toEventCard } from '../events/events.service.js';

@Controller('me/saved-events')
@UseGuards(AuthGuard)
export class SavedEventsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@Req() req: AuthedRequest) {
    // Same card shape as search results, so the web can render the shared
    // event card (category, price, going count) for saved events too.
    const rows = await this.prisma.savedEvent.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, event: { select: EVENT_CARD_SELECT } },
    });
    return rows.map((r) => ({ createdAt: r.createdAt, event: toEventCard(r.event) }));
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
