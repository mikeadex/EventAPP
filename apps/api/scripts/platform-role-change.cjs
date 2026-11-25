/**
 * The write behind grant-platform-role.mjs, kept apart so it can be tested.
 *
 * A role change also ends every session of the account. The admin guard reads
 * the role from the database on each request, but a session made under the
 * old role (or before 2-step was set up) should not carry over into the new
 * one: granting staff makes the holder sign in again through the staff
 * sign-in, with its code step; revoking it ends whatever they had open.
 *
 * CommonJS so jest (ts-jest, CommonJS) and the ESM script can both load it.
 */
async function changePlatformRole(prisma, user, role, via) {
  return prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { platformRole: role } });
    const { count } = await tx.session.deleteMany({ where: { userId: user.id } });
    // Written by hand rather than through AuditLogService: this runs outside
    // Nest, and a role change is exactly the kind of thing that should be
    // answerable later.
    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: 'user.platform_role.grant',
        targetType: 'user',
        targetId: user.id,
        metadata: { from: user.platformRole, to: role, via, sessionsEnded: count },
      },
    });
    return { sessionsEnded: count };
  });
}

module.exports = { changePlatformRole };
