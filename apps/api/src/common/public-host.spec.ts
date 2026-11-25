import { NotFoundException } from '@nestjs/common';
import { EventsService } from '../modules/events/events.service.js';

// The organizations module pulls in Better Auth's setup, whose mailer warns at
// load time when no provider key is set; load it with one so the output stays
// clean.
process.env.RESEND_API_KEY ??= 're_test';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OrganizationsController } = require('../modules/organizations/organizations.module.js') as typeof import('../modules/organizations/organizations.module.js');

type Org = {
  id: string;
  slug: string;
  name: string;
  isDemo: boolean;
  deletedAt: Date | null;
  claimStatus: 'CLAIMED' | 'UNCLAIMED' | 'DISPUTED';
};
type OrgWhere = {
  slug?: string;
  isDemo?: boolean;
  deletedAt?: null;
  claimStatus?: { not: string };
};

const orgs: Org[] = [
  { id: 'o1', slug: 'claimed', name: 'Claimed', isDemo: false, deletedAt: null, claimStatus: 'CLAIMED' },
  { id: 'o2', slug: 'unclaimed', name: 'Unclaimed', isDemo: false, deletedAt: null, claimStatus: 'UNCLAIMED' },
  { id: 'o3', slug: 'taken-down', name: 'Taken down', isDemo: false, deletedAt: null, claimStatus: 'DISPUTED' },
  { id: 'o4', slug: 'removed', name: 'Removed', isDemo: false, deletedAt: new Date(), claimStatus: 'CLAIMED' },
  { id: 'o5', slug: 'demo', name: 'Demo', isDemo: true, deletedAt: null, claimStatus: 'CLAIMED' },
];

/** Applies the organization filters the public queries use. */
const orgMatches = (o: Org, w: OrgWhere = {}) =>
  (w.slug === undefined || o.slug === w.slug) &&
  (w.isDemo === undefined || o.isDemo === w.isDemo) &&
  (w.deletedAt === undefined || o.deletedAt === null) &&
  (w.claimStatus === undefined || o.claimStatus !== w.claimStatus.not);

const events = orgs.map((o) => ({ id: `e-${o.slug}`, organizationId: o.id }));

const prisma = {
  organization: {
    findFirst: jest.fn(
      async ({ where, select }: { where: OrgWhere; select: Record<string, boolean> }) => {
        const o = orgs.find((x) => orgMatches(x, where));
        if (!o) return null;
        return Object.fromEntries(Object.entries(o).filter(([k]) => select[k]));
      },
    ),
  },
  event: {
    findFirst: jest.fn(async ({ where }: { where: { organization?: OrgWhere } }) => {
      const e = events.find((x) =>
        orgMatches(orgs.find((o) => o.id === x.organizationId)!, where.organization),
      );
      return e ? { id: e.id, status: 'CANCELLED' } : null;
    }),
    findMany: jest.fn(async ({ where }: { where: { organization?: { is: OrgWhere } } }) =>
      events
        .filter((e) => orgMatches(orgs.find((o) => o.id === e.organizationId)!, where.organization?.is))
        .map((e) => {
          const o = orgs.find((x) => x.id === e.organizationId)!;
          return {
            id: e.id,
            organization: { slug: o.slug },
            venue: { city: o.slug, country: 'GB' },
            ticketTypes: [],
          };
        }),
    ),
  },
};

describe('public visibility of hosts', () => {
  const svc = new EventsService(prisma as never, {} as never, {} as never);
  const orgsController = new OrganizationsController(prisma as never);

  it('discovery lists events only from hosts that are not taken down or removed', async () => {
    const { items } = await svc.searchPublic({});
    expect(items.map((e) => e.id).sort()).toEqual(['e-claimed', 'e-unclaimed']);
    const withDemo = await svc.searchPublic({}, true);
    expect(withDemo.items.map((e) => e.id).sort()).toEqual(['e-claimed', 'e-demo', 'e-unclaimed']);
  });

  it('the city picker uses the same filter', async () => {
    const { items } = await svc.listCities();
    expect(items.map((c) => c.city).sort()).toEqual(['claimed', 'unclaimed']);
  });

  it('a taken-down or removed host has no page; others do, with their claim status', async () => {
    await expect(orgsController.getBySlug('unclaimed')).resolves.toMatchObject({
      slug: 'unclaimed',
      claimStatus: 'UNCLAIMED',
    });
    await expect(orgsController.getBySlug('claimed')).resolves.toMatchObject({ slug: 'claimed' });
    await expect(orgsController.getBySlug('taken-down')).rejects.toBeInstanceOf(NotFoundException);
    await expect(orgsController.getBySlug('removed')).rejects.toBeInstanceOf(NotFoundException);
  });

  it("a taken-down or removed host's event pages stay closed, even cancelled ones", async () => {
    await expect(svc.getPublicBySlug('claimed', 'any')).resolves.toMatchObject({ id: 'e-claimed' });
    await expect(svc.getPublicBySlug('unclaimed', 'any')).resolves.toMatchObject({ id: 'e-unclaimed' });
    await expect(svc.getPublicBySlug('taken-down', 'any')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.getPublicBySlug('removed', 'any')).rejects.toBeInstanceOf(NotFoundException);
  });
});
