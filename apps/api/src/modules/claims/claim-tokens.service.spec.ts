import { GoneException } from '@nestjs/common';
import { ClaimTokensService, hashToken } from './claim-tokens.service.js';

const NOW = new Date('2026-11-24T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

type Row = {
  id: string;
  organizationId: string;
  kind: 'CLAIM' | 'TAKEDOWN';
  email: string;
  tokenHash: string;
  expiresAt: Date | null;
  usedAt: Date | null;
  revokedAt: Date | null;
  createdByUserId: string | null;
  createdAt: Date;
};
type Org = { id: string; claimStatus: 'CLAIMED' | 'UNCLAIMED' | 'DISPUTED' };
type Where = {
  organizationId?: string;
  kind?: Row['kind'];
  tokenHash?: string;
  usedAt?: null;
  revokedAt?: null;
  OR?: Array<{ expiresAt: null } | { expiresAt: { gte: Date } }>;
};

/** Minimal in-memory stand-in for the Prisma calls the service makes. */
function fakeDb(orgs: Org[]) {
  const rows: Row[] = [];
  const matches = (r: Row, w: Where) =>
    (w.organizationId === undefined || r.organizationId === w.organizationId) &&
    (w.kind === undefined || r.kind === w.kind) &&
    (w.tokenHash === undefined || r.tokenHash === w.tokenHash) &&
    (w.usedAt === undefined || r.usedAt === null) &&
    (w.revokedAt === undefined || r.revokedAt === null) &&
    (w.OR === undefined ||
      w.OR.some((c) =>
        c.expiresAt === null
          ? r.expiresAt === null
          : r.expiresAt !== null && r.expiresAt >= c.expiresAt.gte,
      ));
  const db = {
    rows,
    organizationClaimToken: {
      create: async ({ data }: { data: Partial<Row> }) => {
        const row = {
          id: `t${rows.length + 1}`,
          expiresAt: null,
          usedAt: null,
          revokedAt: null,
          createdByUserId: null,
          createdAt: new Date(),
          ...data,
        } as Row;
        rows.push(row);
        return row;
      },
      findFirst: async ({ where }: { where: Where }) =>
        rows.find((r) => matches(r, where)) ?? null,
      findUnique: async ({ where, include }: { where: { tokenHash: string }; include?: unknown }) => {
        const r = rows.find((x) => x.tokenHash === where.tokenHash);
        if (!r) return null;
        return include ? { ...r, organization: orgs.find((o) => o.id === r.organizationId) } : r;
      },
      findUniqueOrThrow: async ({ where }: { where: { tokenHash: string } }) =>
        rows.find((r) => r.tokenHash === where.tokenHash)!,
      updateMany: async ({ where, data }: { where: Where; data: Partial<Row> }) => {
        const hit = rows.filter((r) => matches(r, where));
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
  };
  return db;
}

const setup = (status: Org['claimStatus'] = 'UNCLAIMED') => {
  const db = fakeDb([{ id: 'org1', claimStatus: status }]);
  const svc = new ClaimTokensService(db as never);
  return { db, svc };
};
const input = { organizationId: 'org1', email: 'pastor@church.org', createdByUserId: 'staff1' };

describe('ClaimTokensService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('stores only the SHA-256 hash, never the raw token', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(db.rows[0]!.tokenHash).toBe(hashToken(raw));
    expect(db.rows[0]!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(db.rows[0]!.tokenHash).not.toBe(raw);
    expect(JSON.stringify(db.rows)).not.toContain(raw);
  });

  it('expires CLAIM in 7 days and TAKEDOWN never', async () => {
    const { db, svc } = setup();
    await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    expect(db.rows[0]!.expiresAt).toEqual(new Date(NOW.getTime() + 7 * DAY));
    expect(db.rows[1]!.expiresAt).toBeNull();
  });

  it('peeks a fresh token as valid with its organization', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    const res = await svc.peek(raw, 'CLAIM');
    expect(res).toMatchObject({
      token: { email: 'pastor@church.org' },
      organization: { id: 'org1' },
    });
  });

  it('peeks unknown tokens and wrong-kind tokens as INVALID', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    expect(await svc.peek('nope', 'CLAIM')).toEqual({ error: 'INVALID' });
    expect(await svc.peek(raw, 'TAKEDOWN')).toEqual({ error: 'INVALID' });
  });

  it('consume twice: second call throws USED', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    await expect(svc.consume(db as never, raw, 'CLAIM')).resolves.toMatchObject({ usedAt: NOW });
    await expect(svc.consume(db as never, raw, 'CLAIM')).rejects.toThrow(GoneException);
    await expect(svc.consume(db as never, raw, 'CLAIM')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'USED' }),
    });
    expect(await svc.peek(raw, 'CLAIM')).toEqual({ error: 'USED' });
  });

  it('resend voids the old CLAIM token: old peeks USED and cannot be consumed', async () => {
    const { db, svc } = setup();
    const oldRaw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    const newRaw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    expect(await svc.peek(oldRaw, 'CLAIM')).toEqual({ error: 'USED' });
    await expect(svc.consume(db as never, oldRaw, 'CLAIM')).rejects.toThrow(GoneException);
    expect(await svc.peek(newRaw, 'CLAIM')).toMatchObject({ organization: { id: 'org1' } });
  });

  it('a CLAIM resend leaves the take-down token alone', async () => {
    const { db, svc } = setup();
    const takedown = await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    expect(await svc.peek(takedown, 'TAKEDOWN')).toMatchObject({ organization: { id: 'org1' } });
  });

  it('issues a fresh take-down token each time, and older ones stay valid', async () => {
    const { db, svc } = setup();
    const first = await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    const second = await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    expect(first).not.toBe(second);
    expect(await svc.peek(first, 'TAKEDOWN')).toMatchObject({ organization: { id: 'org1' } });
    expect(await svc.peek(second, 'TAKEDOWN')).toMatchObject({ organization: { id: 'org1' } });
  });

  it('CLAIM is valid at exactly 7 days and EXPIRED after 7 days + 1s', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    jest.setSystemTime(new Date(NOW.getTime() + 7 * DAY));
    expect(await svc.peek(raw, 'CLAIM')).toMatchObject({ organization: { id: 'org1' } });
    jest.setSystemTime(new Date(NOW.getTime() + 7 * DAY + 1000));
    expect(await svc.peek(raw, 'CLAIM')).toEqual({ error: 'EXPIRED' });
  });

  it('consume refuses an expired token with EXPIRED and leaves it unused', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    jest.setSystemTime(new Date(NOW.getTime() + 7 * DAY + 1000));
    await expect(svc.consume(db as never, raw, 'CLAIM')).rejects.toMatchObject({
      response: expect.objectContaining({ message: 'EXPIRED' }),
    });
    expect(db.rows[0]!.usedAt).toBeNull();
  });

  it('consume refuses unknown tokens and wrong kinds', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    await expect(svc.consume(db as never, 'nope', 'CLAIM')).rejects.toThrow(GoneException);
    await expect(svc.consume(db as never, raw, 'TAKEDOWN')).rejects.toThrow(GoneException);
    expect(db.rows[0]!.usedAt).toBeNull();
  });

  it('TAKEDOWN never expires while UNCLAIMED', async () => {
    const { db, svc } = setup();
    const raw = await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    jest.setSystemTime(new Date(NOW.getTime() + 400 * DAY));
    expect(await svc.peek(raw, 'TAKEDOWN')).toMatchObject({ organization: { id: 'org1' } });
  });

  it('TAKEDOWN peeks CLAIMED once the church is claimed', async () => {
    const { db, svc } = setup('CLAIMED');
    const raw = await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    expect(await svc.peek(raw, 'TAKEDOWN')).toEqual({ error: 'CLAIMED' });
  });

  it('CLAIM peeks CLAIMED when the church is already claimed', async () => {
    const { db, svc } = setup('CLAIMED');
    const raw = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    expect(await svc.peek(raw, 'CLAIM')).toEqual({ error: 'CLAIMED' });
  });

  it('DISPUTED church: the take-down already happened, so both kinds peek USED', async () => {
    const { db, svc } = setup('DISPUTED');
    const takedown = await svc.issue(db as never, { ...input, kind: 'TAKEDOWN' });
    const claim = await svc.issue(db as never, { ...input, kind: 'CLAIM' });
    expect(await svc.peek(takedown, 'TAKEDOWN')).toEqual({ error: 'USED' });
    expect(await svc.peek(claim, 'CLAIM')).toEqual({ error: 'USED' });
  });
});
