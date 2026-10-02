import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUserService } from './current-user.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * Decides whether a request may see organisations marked `isDemo`.
 *
 * Seed organisations exist so a store reviewer signing in with the credentials
 * we publish finds a populated app rather than an empty one. Everyone else gets
 * real listings only — their events are fabricated, and a real person booking a
 * place at one turns up to an empty room.
 */
@Injectable()
export class DemoVisibilityService {
  constructor(
    private readonly currentUser: CurrentUserService,
    private readonly prisma: PrismaService,
  ) {}

  async allows(req: Request): Promise<boolean> {
    // Browsing deliberately works without an account, so most requests to the
    // feed carry no credential at all. Answer those without touching the
    // database: resolving a session is itself a query, and this runs on the
    // hottest endpoint in the API.
    if (!req.headers.authorization && !req.headers.cookie) return false;

    const user = await this.currentUser.fromRequest(req);
    if (!user) return false;

    // Read the column rather than trusting the session. Better Auth does not
    // carry custom User fields into the session object — that is why
    // PlatformRoleGuard reads platformRole from the database too, and a flag
    // that silently defaults to false would fail open here in the other
    // direction: a reviewer seeing an empty app and rejecting the build.
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { seesDemoContent: true },
    });
    return row?.seesDemoContent ?? false;
  }
}
