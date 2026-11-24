import { ConflictException, GoneException, Injectable } from '@nestjs/common';
import type { ClaimTokenKind, Organization, OrganizationClaimToken, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service.js';

/** A claim link stays usable for 7 days. Take-down links never expire. */
const CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient | PrismaService;

export type ClaimTokenError = 'INVALID' | 'USED' | 'EXPIRED' | 'CLAIMED';
export type PeekResult =
  | { token: OrganizationClaimToken; organization: Organization }
  | { error: ClaimTokenError };

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Single-use tokens that let a church's contact claim, or take down, a church
 * page that staff added. Only the SHA-256 of a token is stored, so a database
 * read never yields a working link.
 */
@Injectable()
export class ClaimTokensService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the raw token; this is the only time it exists in the clear. */
  async issue(
    tx: Db,
    input: {
      organizationId: string;
      email: string;
      kind: ClaimTokenKind;
      createdByUserId: string | null;
    },
  ): Promise<string> {
    const now = new Date();
    if (input.kind === 'CLAIM') {
      // A resend voids every earlier link that could still be used.
      await tx.organizationClaimToken.updateMany({
        where: {
          organizationId: input.organizationId,
          kind: 'CLAIM',
          usedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: now },
      });
    } else {
      const existing = await tx.organizationClaimToken.findFirst({
        where: { organizationId: input.organizationId, kind: 'TAKEDOWN' },
      });
      if (existing) throw new ConflictException('TAKEDOWN_TOKEN_EXISTS');
    }

    const raw = randomBytes(32).toString('base64url');
    await tx.organizationClaimToken.create({
      data: {
        organizationId: input.organizationId,
        kind: input.kind,
        email: input.email,
        tokenHash: hashToken(raw),
        expiresAt: input.kind === 'CLAIM' ? new Date(now.getTime() + CLAIM_TTL_MS) : null,
        createdByUserId: input.createdByUserId,
      },
    });
    return raw;
  }

  /** Read-only check, for rendering the claim or take-down page. */
  async peek(raw: string, kind: ClaimTokenKind): Promise<PeekResult> {
    const token = await this.prisma.organizationClaimToken.findUnique({
      where: { tokenHash: hashToken(raw) },
      include: { organization: true },
    });
    if (!token || token.kind !== kind) return { error: 'INVALID' };

    const { organization, ...row } = token;
    // Revoked (voided by a resend) reads the same as used.
    if (row.usedAt || row.revokedAt) return { error: 'USED' };
    if (organization.claimStatus === 'CLAIMED') return { error: 'CLAIMED' };
    // DISPUTED means the take-down already happened; no link is live any more.
    if (organization.claimStatus === 'DISPUTED') return { error: 'USED' };
    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return { error: 'EXPIRED' };
    return { token: row, organization };
  }

  /**
   * Atomically spends a token. The conditional update is the lock: two
   * concurrent callers cannot both win, and an expired token is refused in
   * the same statement.
   */
  async consume(tx: Db, raw: string, kind: ClaimTokenKind): Promise<OrganizationClaimToken> {
    const tokenHash = hashToken(raw);
    const now = new Date();
    const { count } = await tx.organizationClaimToken.updateMany({
      where: {
        tokenHash,
        kind,
        usedAt: null,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
      },
      data: { usedAt: now },
    });
    if (count === 0) {
      const row = await tx.organizationClaimToken.findUnique({ where: { tokenHash } });
      if (!row || row.kind !== kind) throw new GoneException('INVALID');
      const expired = !row.usedAt && !row.revokedAt && row.expiresAt && row.expiresAt < now;
      throw new GoneException(expired ? 'EXPIRED' : 'USED');
    }
    return tx.organizationClaimToken.findUniqueOrThrow({ where: { tokenHash } });
  }
}
