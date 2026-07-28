import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  FEATURE_FLAG_DEFAULTS,
  FeatureFlag,
  type CapabilityManifest,
} from '@ekklesia/shared';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolution order:
   *   1. organization_feature_flags override (if orgId given)
   *   2. platform feature_flags row
   *   3. compile-time default
   */
  async resolveForOrganization(organizationId: string | null): Promise<CapabilityManifest> {
    const platform = await this.prisma.featureFlag.findMany();
    const platformMap = new Map(platform.map((f) => [f.key, f.enabled]));

    const overrideMap = organizationId
      ? new Map(
          (
            await this.prisma.organizationFeatureFlag.findMany({
              where: { organizationId },
            })
          ).map((o) => [o.flagKey, o.enabled]),
        )
      : new Map<string, boolean>();

    const manifest = { ...FEATURE_FLAG_DEFAULTS };
    for (const key of Object.values(FeatureFlag)) {
      if (overrideMap.has(key)) {
        manifest[key] = overrideMap.get(key)!;
      } else if (platformMap.has(key)) {
        manifest[key] = platformMap.get(key)!;
      }
    }
    return manifest;
  }

  /** User capabilities use the platform-level resolution for now. */
  async resolveForUser(_userId: string): Promise<CapabilityManifest> {
    return this.resolveForOrganization(null);
  }
}
