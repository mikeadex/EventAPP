"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORG_ROLE_RANK = exports.OrgRole = exports.PlatformRole = void 0;
/**
 * Platform-level roles. A user has at most one platform role.
 */
exports.PlatformRole = {
    USER: 'user',
    PLATFORM_ADMIN: 'platform_admin',
    PLATFORM_MODERATOR: 'platform_moderator',
    PLATFORM_SUPPORT: 'platform_support',
};
/**
 * Organization-scoped roles. A user can hold different roles in different organizations.
 */
exports.OrgRole = {
    MEMBER: 'member',
    VOLUNTEER: 'volunteer',
    ORGANIZER: 'organizer',
    FINANCE_MANAGER: 'finance_manager',
    MODERATOR: 'moderator',
    CHURCH_ADMIN: 'church_admin',
    OWNER: 'owner',
};
exports.ORG_ROLE_RANK = {
    member: 0,
    volunteer: 10,
    organizer: 20,
    moderator: 30,
    finance_manager: 30,
    church_admin: 40,
    owner: 50,
};
//# sourceMappingURL=roles.js.map