import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClaimTokensService } from './claim-tokens.service.js';

@Module({
  providers: [PrismaService, ClaimTokensService],
  exports: [ClaimTokensService],
})
export class ClaimsModule {}
