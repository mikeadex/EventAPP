import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { requestClientIp } from './client-ip.js';

export interface AuditLogEntry {
  actorUserId?: string;
  organizationId?: string;
  /** Canonical dotted action key, e.g. "event.publish". */
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  /** Optional request reference; the service will extract ip + userAgent. */
  req?: Request;
  /** Use this when writing inside a Prisma transaction. */
  tx?: Prisma.TransactionClient | PrismaClient;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async write(entry: AuditLogEntry): Promise<void> {
    const client = entry.tx ?? this.prisma;
    // Same trusted header order as the staff sign-in audit: never the
    // client-supplied left-most X-Forwarded-For entry.
    const ipAddress = requestClientIp(entry.req);
    const userAgent = entry.req?.headers['user-agent'];

    await client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId,
        organizationId: entry.organizationId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        metadata: entry.metadata ?? undefined,
        ipAddress,
        userAgent: typeof userAgent === 'string' ? userAgent : undefined,
      },
    });
  }
}
