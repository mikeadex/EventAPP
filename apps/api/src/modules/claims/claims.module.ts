import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module.js';
import { EventsModule } from '../events/events.module.js';
import { BetterAuthClaimAccounts } from './better-auth-claim-accounts.js';
import { ClaimTokensService } from './claim-tokens.service.js';
import { ClaimsController, ClientIpThrottlerGuard } from './claims.controller.js';
import { ClaimAccounts, ClaimsService } from './claims.service.js';

@Module({
  imports: [
    AuthModule,
    EventsModule,
    // Provides the guard's storage and options; the limit itself is set on
    // the controller with @Throttle (CLAIMS_RATE_LIMIT).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
  ],
  controllers: [ClaimsController],
  providers: [
    ClaimTokensService,
    ClaimsService,
    ClientIpThrottlerGuard,
    { provide: ClaimAccounts, useClass: BetterAuthClaimAccounts },
  ],
  exports: [ClaimTokensService, ClaimsService],
})
export class ClaimsModule {}
