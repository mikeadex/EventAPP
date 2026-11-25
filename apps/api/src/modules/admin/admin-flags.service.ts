import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { FEATURE_FLAG_DEFAULTS, FeatureFlag } from '@ekklesia/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { AuditLogService } from '../../common/audit-log.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const SetFlagSchema = z.object({ enabled: z.boolean() });
const SetOverrideSchema = z.object({
  /** null clears the override so the organisation follows the platform value. */
  enabled: z.boolean().nullable(),
});

const KEYS = new Set<string>(Object.values(FeatureFlag));

/**
 * Feature flags, as the console sees them.
 *
 * Changing one here is how a feature is switched on in production without
 * touching the database by hand: the API already resolves flags per request
 * (platform row, then per-organisation override, then the compile-time
 * default), so a change takes effect on the next request.
 */
@Injectable()
export class AdminFlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async list() {
    const [rows, overrides] = await Promise.all([
      this.prisma.featureFlag.findMany(),
      this.prisma.organizationFeatureFlag.findMany({
        include: { organization: { select: { id: true, name: true, slug: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return Object.values(FeatureFlag).map((key) => {
      const row = byKey.get(key);
      return {
        key,
        description: row?.description ?? null,
        default: FEATURE_FLAG_DEFAULTS[key],
        // No row means the compile-time default governs.
        enabled: row ? row.enabled : FEATURE_FLAG_DEFAULTS[key],
        updatedAt: row?.updatedAt.toISOString() ?? null,
        overrides: overrides
          .filter((o) => o.flagKey === key)
          .map((o) => ({
            organizationId: o.organization.id,
            name: o.organization.name,
            slug: o.organization.slug,
            enabled: o.enabled,
            updatedAt: o.updatedAt.toISOString(),
          })),
      };
    });
  }

  async setPlatform(key: string, actorUserId: string, body: unknown, req?: Request) {
    this.assertKey(key);
    const { enabled } = SetFlagSchema.parse(body);
    const row = await this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled },
      update: { enabled },
    });
    await this.audit.write({
      actorUserId,
      organizationId: undefined,
      action: 'feature_flag.set',
      targetType: 'feature_flag',
      targetId: key,
      metadata: { enabled } as never,
      req,
    });
    return { key: row.key, enabled: row.enabled };
  }

  async setOverride(key: string, orgIdOrSlug: string, actorUserId: string, body: unknown, req?: Request) {
    this.assertKey(key);
    const { enabled } = SetOverrideSchema.parse(body);
    const org = await this.prisma.organization.findFirst({
      where: { OR: [{ id: orgIdOrSlug }, { slug: orgIdOrSlug }] },
      select: { id: true, name: true, slug: true },
    });
    if (!org) throw new NotFoundException('Organisation not found');

    // The platform row must exist for the override's foreign key.
    await this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled: FEATURE_FLAG_DEFAULTS[key as FeatureFlag] },
      update: {},
    });
    if (enabled === null) {
      await this.prisma.organizationFeatureFlag.deleteMany({
        where: { organizationId: org.id, flagKey: key },
      });
    } else {
      await this.prisma.organizationFeatureFlag.upsert({
        where: { organizationId_flagKey: { organizationId: org.id, flagKey: key } },
        create: { organizationId: org.id, flagKey: key, enabled },
        update: { enabled },
      });
    }
    await this.audit.write({
      actorUserId,
      organizationId: org.id,
      action: enabled === null ? 'feature_flag.override_cleared' : 'feature_flag.override_set',
      targetType: 'feature_flag',
      targetId: key,
      metadata: { enabled } as never,
      req,
    });
    return { key, organization: org, enabled };
  }

  private assertKey(key: string) {
    if (!KEYS.has(key)) throw new BadRequestException(`Unknown feature flag "${key}"`);
  }
}
