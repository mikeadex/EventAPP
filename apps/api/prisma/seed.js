"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const shared_1 = require("@ekklesia/shared");
const prisma = new client_1.PrismaClient();
async function main() {
    // Seed feature flags from compile-time defaults.
    for (const [key, enabled] of Object.entries(shared_1.FEATURE_FLAG_DEFAULTS)) {
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
//# sourceMappingURL=seed.js.map