import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EventsModule } from '../events/events.module.js';
import { BetterAuthClaimAccounts } from './better-auth-claim-accounts.js';
import { ClaimTokensService } from './claim-tokens.service.js';
import { ClaimsController, ClientIpThrottlerGuard } from './claims.controller.js';
import { ClaimAccounts, ClaimsService } from './claims.service.js';

@Module({
  imports: [AuthModule, EventsModule],
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
