import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Module,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { PushService } from './push.service.js';

const RegisterSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android']),
});

const UnregisterSchema = z.object({ token: z.string().min(1) });

@Controller('devices')
@UseGuards(AuthGuard)
class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Register this device for push.
   *
   * Upserts on the token, not on (user, token). A phone handed over or signed
   * into by someone else keeps the same Expo token, and the row must follow the
   * person who registered it last — otherwise the new user's notifications
   * would go to the previous account, or worse, the previous account's would
   * keep arriving on a device that is no longer theirs.
   *
   * Re-registering also clears `disabledAt`, so a reinstall recovers a token we
   * had previously retired as dead.
   */
  @Post()
  async register(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { token, platform } = RegisterSchema.parse(body);
    const now = new Date();
    await this.prisma.device.upsert({
      where: { token },
      create: { token, platform, userId: req.user.id },
      update: { userId: req.user.id, platform, lastSeenAt: now, disabledAt: null },
    });
    return { ok: true };
  }

  /** Called on sign-out, so a shared device stops receiving for this account. */
  @Delete()
  @HttpCode(204)
  async unregister(@Req() req: AuthedRequest, @Body() body: unknown) {
    const { token } = UnregisterSchema.parse(body);
    // Scoped to the caller: possessing a token string must not let anyone
    // unregister someone else's device.
    await this.prisma.device.deleteMany({ where: { token, userId: req.user.id } });
  }
}

@Module({
  imports: [AuthModule],
  controllers: [DevicesController],
  providers: [PrismaService, PushService],
  exports: [PushService],
})
export class PushModule {}
