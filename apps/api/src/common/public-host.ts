import type { Prisma } from '@prisma/client';

/**
 * Hosts the public may see: not removed by staff, and not taken down by the
 * church itself (DISPUTED). Applied to the host page and to discovery; event
 * pages and tickets reached by direct link are deliberately not filtered, so
 * tickets people already hold keep opening.
 */
export const PUBLIC_HOST_WHERE = {
  deletedAt: null,
  claimStatus: { not: 'DISPUTED' },
} satisfies Prisma.OrganizationWhereInput;
