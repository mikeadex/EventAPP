import {
  Body,
  Controller,
  Get,
  HttpCode,
  Injectable,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUserService } from '../auth/current-user.service.js';
import { clientIp } from '../auth/staff-signin.js';
import { ClaimsService } from './claims.service.js';

/**
 * Rate-limits by client address. Behind Vercel the socket address is the
 * proxy's, so this uses the same trusted header order as the staff sign-in
 * audit (see clientIp) rather than `req.ip`.
 */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const r = req as unknown as Request;
    const headers = new Headers();
    for (const [k, v] of Object.entries(r.headers ?? {})) {
      if (typeof v === 'string') headers.set(k, v);
    }
    return clientIp(headers) ?? r.ip ?? r.socket?.remoteAddress ?? 'unknown';
  }
}

/** Per client address, per route. */
export const CLAIMS_RATE_LIMIT = { limit: 10, ttl: 60_000 };

/**
 * Public pages behind the links in the claim email. Anyone holding a link can
 * call these, so every route is rate-limited: plenty for a person, little use
 * for guessing.
 */
@Controller()
@UseGuards(ClientIpThrottlerGuard)
@Throttle({ default: CLAIMS_RATE_LIMIT })
export class ClaimsController {
  constructor(
    private readonly claims: ClaimsService,
    private readonly currentUser: CurrentUserService,
  ) {}

  @Get('claims/:token')
  getClaim(@Param('token') token: string) {
    return this.claims.getClaim(token);
  }

  @Post('claims/:token/password')
  @HttpCode(200)
  claimWithPassword(@Param('token') token: string, @Body() body: unknown, @Req() req: Request) {
    return this.claims.claimWithPassword(token, body, req);
  }

  @Post('claims/:token/attach')
  @HttpCode(200)
  async attach(@Param('token') token: string, @Req() req: Request) {
    const user = await this.currentUser.requireFromRequest(req);
    return this.claims.attach(token, user, req);
  }

  /** Expired link: email a fresh one to the church's address on file. */
  @Post('claims/:token/renew')
  @HttpCode(200)
  renewClaim(@Param('token') token: string, @Req() req: Request) {
    return this.claims.renewClaim(token, req);
  }

  @Get('takedown/:token')
  getTakedown(@Param('token') token: string) {
    return this.claims.getTakedown(token);
  }

  @Post('takedown/:token')
  @HttpCode(200)
  takedown(@Param('token') token: string, @Body() body: unknown, @Req() req: Request) {
    return this.claims.takedown(token, body, req);
  }
}
