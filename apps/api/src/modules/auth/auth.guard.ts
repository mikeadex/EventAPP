import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUserService, AuthedUser } from './current-user.service.js';

export interface AuthedRequest extends Request {
  user: AuthedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly currentUser: CurrentUserService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = await this.currentUser.fromRequest(req);
    if (!user) throw new UnauthorizedException();
    req.user = user;
    return true;
  }
}
