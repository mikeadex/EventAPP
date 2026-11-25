// The grant-role script's write lives in a CommonJS helper outside src/ so the
// ESM script and this spec can share it.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { changePlatformRole } = require('../../scripts/platform-role-change.cjs') as {
  changePlatformRole: (
    prisma: unknown,
    user: { id: string; platformRole: string },
    role: string,
    via: string,
  ) => Promise<{ sessionsEnded: number }>;
};

function fakeDb() {
  const state = {
    users: [{ id: 'u1', platformRole: 'USER' }],
    sessions: [
      { id: 's1', userId: 'u1' },
      { id: 's2', userId: 'u1' },
      { id: 's3', userId: 'u2' },
    ],
    audits: [] as Array<{ action: string; metadata: unknown }>,
  };
  const tx = {
    user: {
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { platformRole: string } }) =>
        Object.assign(state.users.find((u) => u.id === where.id)!, data),
      ),
    },
    session: {
      deleteMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
        const before = state.sessions.length;
        state.sessions = state.sessions.filter((s) => s.userId !== where.userId);
        return { count: before - state.sessions.length };
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: { data: { action: string; metadata: unknown } }) => {
        state.audits.push(data);
        return data;
      }),
    },
  };
  const prisma = { $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) };
  return { prisma, tx, state };
}

describe('grant-role script: changePlatformRole', () => {
  it.each([
    ['USER', 'PLATFORM_MODERATOR'],
    ['PLATFORM_ADMIN', 'USER'],
  ])('%s -> %s changes the role, ends every session of that account and audits it', async (from, to) => {
    const { prisma, state } = fakeDb();
    state.users[0]!.platformRole = from;
    const res = await changePlatformRole(prisma, { id: 'u1', platformRole: from }, to, 'test');

    expect(res).toEqual({ sessionsEnded: 2 });
    expect(state.users[0]!.platformRole).toBe(to);
    expect(state.sessions).toEqual([{ id: 's3', userId: 'u2' }]);
    expect(state.audits).toEqual([
      expect.objectContaining({
        action: 'user.platform_role.grant',
        metadata: { from, to, via: 'test', sessionsEnded: 2 },
      }),
    ]);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
