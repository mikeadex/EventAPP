import { Global, Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from './audit-log.service.js';
import { OrgMembershipGuard } from './org-membership.guard.js';
import { AuthModule } from '../modules/auth/auth.module.js';

@Global()
@Module({
  imports: [AuthModule],
  providers: [AuditLogService, OrgMembershipGuard, Reflector],
  exports: [AuditLogService, OrgMembershipGuard],
})
export class CommonModule {}
