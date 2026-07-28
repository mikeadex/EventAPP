import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

@Controller('health')
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db: string = 'unknown';
    let dbError: string | undefined;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = 'ok';
    } catch (err) {
      db = 'error';
      dbError = (err as Error).message;
    }
    return { status: 'ok', db, dbError, timestamp: new Date().toISOString() };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
