import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminFlagsService } from './admin-flags.service.js';

/**
 * The console's flag switches against a hand-rolled fake: that a missing row
 * reads as the compile-time default, that a platform write upserts the row,
 * that an override is keyed on the organisation and cleared with null, and
 * that unknown keys are refused before anything is written.
 */
function makeFakes() {
  const flags = new Map<string, { key: string; enabled: boolean; description: string | null; updatedAt: Date }>();
  const overrides = new Map<string, { organizationId: string; flagKey: string; enabled: boolean; updatedAt: Date }>();
  const orgs = [{ id: 'org1', name: 'Grace', slug: 'grace' }];
  const audit: unknown[] = [];
  const prisma = {
    featureFlag: {
      findMany: async () => [...flags.values()],
      upsert: async ({ where, create, update }: any) => {
        const row = flags.get(where.key);
        const next = row
          ? { ...row, ...update, updatedAt: new Date() }
          : { description: null, ...create, updatedAt: new Date() };
        flags.set(where.key, next);
        return next;
      },
    },
    organizationFeatureFlag: {
      findMany: async () =>
        [...overrides.values()].map((o) => ({ ...o, organization: orgs.find((x) => x.id === o.organizationId) })),
      upsert: async ({ where: { organizationId_flagKey: k }, create, update }: any) => {
        const id = `${k.organizationId}:${k.flagKey}`;
        const row = overrides.get(id);
        const next = row ? { ...row, ...update, updatedAt: new Date() } : { ...create, updatedAt: new Date() };
        overrides.set(id, next);
        return next;
      },
      deleteMany: async ({ where }: any) => {
        const id = `${where.organizationId}:${where.flagKey}`;
        return { count: overrides.delete(id) ? 1 : 0 };
      },
    },
    organization: {
      findFirst: async ({ where }: any) =>
        orgs.find((o) => where.OR.some((c: any) => c.id === o.id || c.slug === o.slug)) ?? null,
    },
  };
  const service = new AdminFlagsService(prisma as never, { write: async (e: unknown) => void audit.push(e) } as never);
  return { service, flags, overrides, audit };
}

describe('AdminFlagsService', () => {
  it('reports the compile-time default when there is no row', async () => {
    const { service } = makeFakes();
    const list = await service.list();
    const paid = list.find((f) => f.key === 'paid_tickets')!;
    expect(paid.enabled).toBe(false);
    expect(paid.default).toBe(false);
    expect(paid.updatedAt).toBeNull();
    expect(list.find((f) => f.key === 'waitlists')!.enabled).toBe(true);
  });

  it('switches a flag on for the platform and audits it', async () => {
    const { service, flags, audit } = makeFakes();
    await service.setPlatform('paid_tickets', 'staff1', { enabled: true });
    expect(flags.get('paid_tickets')!.enabled).toBe(true);
    expect((await service.list()).find((f) => f.key === 'paid_tickets')!.enabled).toBe(true);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ action: 'feature_flag.set', targetId: 'paid_tickets', actorUserId: 'staff1' });
  });

  it('refuses an unknown key and a non-boolean body', async () => {
    const { service, flags } = makeFakes();
    await expect(service.setPlatform('teleport', 'staff1', { enabled: true })).rejects.toThrow(BadRequestException);
    await expect(service.setPlatform('paid_tickets', 'staff1', { enabled: 'yes' })).rejects.toThrow();
    expect(flags.size).toBe(0);
  });

  it('sets an override by slug, lists it, and clears it with null', async () => {
    const { service, overrides } = makeFakes();
    await service.setOverride('paid_tickets', 'grace', 'staff1', { enabled: true });
    expect(overrides.get('org1:paid_tickets')!.enabled).toBe(true);
    const listed = (await service.list()).find((f) => f.key === 'paid_tickets')!;
    expect(listed.enabled).toBe(false); // platform value untouched
    expect(listed.overrides).toEqual([expect.objectContaining({ organizationId: 'org1', slug: 'grace', enabled: true })]);

    await service.setOverride('paid_tickets', 'org1', 'staff1', { enabled: null });
    expect(overrides.size).toBe(0);
  });

  it('404s an override for an organisation that does not exist', async () => {
    const { service } = makeFakes();
    await expect(service.setOverride('paid_tickets', 'nobody', 'staff1', { enabled: true })).rejects.toThrow(
      NotFoundException,
    );
  });
});
