/**
 * Platform-level roles. A user has at most one platform role.
 */
export declare const PlatformRole: {
    readonly USER: "user";
    readonly PLATFORM_ADMIN: "platform_admin";
    readonly PLATFORM_MODERATOR: "platform_moderator";
    readonly PLATFORM_SUPPORT: "platform_support";
};
export type PlatformRole = (typeof PlatformRole)[keyof typeof PlatformRole];
/**
 * Organization-scoped roles. A user can hold different roles in different organizations.
 */
export declare const OrgRole: {
    readonly MEMBER: "member";
    readonly VOLUNTEER: "volunteer";
    readonly ORGANIZER: "organizer";
    readonly FINANCE_MANAGER: "finance_manager";
    readonly MODERATOR: "moderator";
    readonly CHURCH_ADMIN: "church_admin";
    readonly OWNER: "owner";
};
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];
export declare const ORG_ROLE_RANK: Record<OrgRole, number>;
//# sourceMappingURL=roles.d.ts.map