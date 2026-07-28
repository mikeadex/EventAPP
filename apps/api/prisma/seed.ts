import { PrismaClient } from '@prisma/client';
import { FEATURE_FLAG_DEFAULTS } from '@ekklesia/shared';

const prisma = new PrismaClient();

async function main() {
  // Seed feature flags from compile-time defaults.
  for (const [key, enabled] of Object.entries(FEATURE_FLAG_DEFAULTS)) {
    await prisma.featureFlag.upsert({
      where: { key },
      update: {},
      create: { key, enabled },
    });
  }

  // Demo platform admin (dev only — do not run in prod).
  if (process.env.NODE_ENV !== 'production') {
    await prisma.user.upsert({
      where: { email: 'admin@ekklesia.local' },
      update: {},
      create: {
        email: 'admin@ekklesia.local',
        name: 'Platform Admin',
        emailVerified: true,
        platformRole: 'PLATFORM_ADMIN',
        profile: { create: { displayName: 'Platform Admin' } },
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
