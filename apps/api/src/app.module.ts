import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module.js';
import { CommonModule } from './common/common.module.js';
import { EmailModule } from './modules/email/email.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module.js';
import { ModerationModule } from './modules/moderation/moderation.module.js';
import { AdminModule } from './modules/admin/admin.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    CommonModule,
    EmailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    EventsModule,
    TicketsModule,
    PaymentsModule,
    FeatureFlagsModule,
    ModerationModule,
    AdminModule,
    UploadsModule,
  ],
})
export class AppModule {}
