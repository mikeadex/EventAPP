import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { getAuth } from './auth.js';

export interface AuthedUser {
  id: string;
  email: string;
  platformRole: string;
}

@Injectable()
export class CurrentUserService {
  async fromRequest(req: Request): Promise<AuthedUser | null> {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (typeof v === 'string') headers.set(k, v);
    }
    const auth = await getAuth();
    const session = await auth.api.getSession({ headers });
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      platformRole: (session.user as { platformRole?: string }).platformRole ?? 'USER',
    };
  }

  async requireFromRequest(req: Request): Promise<AuthedUser> {
    const user = await this.fromRequest(req);
    if (!user) throw new UnauthorizedException('Authentication required');
    return user;
  }
}
