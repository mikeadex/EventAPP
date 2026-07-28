import { SetMetadata } from '@nestjs/common';
import type { Permission } from '@ekklesia/shared';

/**
 * Server-side permission requirements for a controller method. The
 * OrgMembershipGuard reads these and enforces them against the actor's
 * org-scoped role.
 *
 * Use together with @OrgParam('orgId') / @OrgParam('slug') to identify
 * which organization scope the call applies to.
 */
export const PERMISSIONS_KEY = 'ekklesia.permissions';
export const RequirePermissions = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);

export const ORG_SCOPE_KEY = 'ekklesia.orgScope';
/**
 * Declares how the guard should locate the orgId from the request.
 *   - 'param:<name>'  — read req.params[<name>], treat as orgId
 *   - 'paramSlug:<name>' — read req.params[<name>], treat as org slug (will lookup)
 *   - 'body:<path>'   — read a dotted body path, treat as orgId
 *   - 'eventParam:<name>' — read event id from params, infer org from event row
 */
export const OrgScope = (location: string) => SetMetadata(ORG_SCOPE_KEY, location);

export const PLATFORM_ROLE_KEY = 'ekklesia.platformRole';
export const RequirePlatformRole = (role: 'PLATFORM_ADMIN' | 'PLATFORM_MODERATOR' | 'PLATFORM_SUPPORT') =>
  SetMetadata(PLATFORM_ROLE_KEY, role);
