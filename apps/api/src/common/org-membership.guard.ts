import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  DEFAULT_ORG_PERMISSIONS,
  OrgRole as SharedOrgRole,
  type Permission,
} from '@ekklesia/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { CurrentUserService, type AuthedUser } from '../modules/auth/current-user.service.js';
import { ORG_SCOPE_KEY, PERMISSIONS_KEY, PLATFORM_ROLE_KEY } from './decorators.js';

export interface AuthedOrgRequest extends Request {
  user: AuthedUser;
  /** Resolved organization id for this request, populated by the guard. */
  orgId: string;
  /** Effective permissions granted to the actor within that organization. */
  orgPermissions: Set<Permission>;
}

/**
 * Combined auth + org-membership + permission guard.
 *
 * Decorator inputs (set on the controller method):
 *   @RequirePermissions(Permission.EVENT_CREATE, ...)
 *   @OrgScope('param:orgId' | 'paramSlug:slug' | 'body:organizationId' | 'eventParam:eventId')
 *   @RequirePlatformRole('PLATFORM_ADMIN')   // optional
 *
 * Behaviour:
 *   1. Resolves the current user via Better Auth. 401 if missing.
 *   2. If @RequirePlatformRole is set, checks the user's platformRole.
 *      Platform admins bypass org-membership checks below.
 *   3. Resolves the target organizationId from @OrgScope.
 *   4. Looks up the user's OrganizationMembership in that org. 403 if none.
 *   5. Expands the membership role into a permission set and verifies all
 *      required permissions are present. 403 otherwise.
 *   6. Decorates the request with `user`, `orgId`, and `orgPermissions` for
 *      downstream handlers to consume.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedOrgRequest>();
    const handler = ctx.getHandler();
    const cls = ctx.getClass();

    // 1. Authenticate.
    const user = await this.currentUser.fromRequest(req);
    if (!user) throw new UnauthorizedException();
    req.user = user;

    // 2. Platform-role gate (if declared).
    const requiredPlatformRole = this.reflector.getAllAndOverride<string | undefined>(
      PLATFORM_ROLE_KEY,
      [handler, cls],
    );
    if (requiredPlatformRole && user.platformRole !== requiredPlatformRole) {
      throw new ForbiddenException(`Requires platform role: ${requiredPlatformRole}`);
    }

    // Required perms — may be empty if guard is used purely for auth+scope.
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      [handler, cls],
    ) ?? [];

    // 3. Resolve orgId.
    const scope = this.reflector.getAllAndOverride<string | undefined>(ORG_SCOPE_KEY, [
      handler,
      cls,
    ]);
    if (!scope && required.length === 0) {
      // Auth-only use: skip org checks.
      return true;
    }
    if (!scope) {
      throw new ForbiddenException('Missing @OrgScope() declaration on protected handler');
    }
    const orgId = await this.resolveOrgId(req, scope);
    req.orgId = orgId;

    // Platform admins bypass per-org membership checks.
    if (user.platformRole === 'PLATFORM_ADMIN') {
      req.orgPermissions = new Set(Object.values(DEFAULT_ORG_PERMISSIONS.owner));
      return true;
    }

    // 4. Membership lookup.
    const membership = await this.prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });
    if (!membership) {
      throw new ForbiddenException('Not a member of this organization');
    }

    // 5. Permission expansion.
    const roleKey = membership.role.toLowerCase() as keyof typeof DEFAULT_ORG_PERMISSIONS;
    const perms = new Set<Permission>(DEFAULT_ORG_PERMISSIONS[roleKey] ?? []);
    req.orgPermissions = perms;

    for (const need of required) {
      if (!perms.has(need)) {
        throw new ForbiddenException(`Missing permission: ${need}`);
      }
    }
    return true;
  }

  private async resolveOrgId(req: Request, scope: string): Promise<string> {
    const [kind, key] = scope.split(':');
    if (!kind || !key) throw new ForbiddenException(`Invalid @OrgScope value: ${scope}`);

    switch (kind) {
      case 'param': {
        const id = readStringParam(req, key);
        if (!id) throw new ForbiddenException(`Missing route param: ${key}`);
        return id;
      }
      case 'paramSlug': {
        const slug = readStringParam(req, key);
        if (!slug) throw new ForbiddenException(`Missing route param: ${key}`);
        const org = await this.prisma.organization.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (!org) throw new NotFoundException(`Organization '${slug}' not found`);
        return org.id;
      }
      case 'body': {
        const body = (req.body ?? {}) as Record<string, unknown>;
        const id = body[key];
        if (typeof id !== 'string') {
          throw new ForbiddenException(`Missing body field: ${key}`);
        }
        return id;
      }
      case 'eventParam': {
        const eventId = readStringParam(req, key);
        if (!eventId) throw new ForbiddenException(`Missing route param: ${key}`);
        const evt = await this.prisma.event.findUnique({
          where: { id: eventId },
          select: { organizationId: true },
        });
        if (!evt) throw new NotFoundException(`Event '${eventId}' not found`);
        return evt.organizationId;
      }
      default:
        throw new ForbiddenException(`Unknown @OrgScope kind: ${kind}`);
    }
  }
}

// Suppress unused-import warning (kept for future role-aware extensions).
void SharedOrgRole;

/** Express's typed params can be `string | string[]` — normalise. */
function readStringParam(req: Request, key: string): string | undefined {
  const v = req.params[key];
  return typeof v === 'string' ? v : undefined;
}
