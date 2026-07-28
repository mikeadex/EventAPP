import {
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { CreateOrganizationSchema, type CreateOrganizationInput } from '@ekklesia/shared';

@Controller('organizations')
class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        kind: true,
        shortDescription: true,
        description: true,
        websiteUrl: true,
        logoUrl: true,
        coverImageUrl: true,
        country: true,
        verificationStatus: true,
      },
    });
    if (!org) throw new NotFoundException(`Organization '${slug}' not found`);
    return org;
  }

  @Post()
  @UseGuards(AuthGuard)
  async create(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input: CreateOrganizationInput = CreateOrganizationSchema.parse(body);
    try {
      return await this.createInTransaction(req, input);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException(`Slug '${input.slug}' is already taken`);
      }
      throw err;
    }
  }

  private async createInTransaction(req: AuthedRequest, input: CreateOrganizationInput) {
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          slug: input.slug,
          name: input.name,
          kind: input.kind.toUpperCase() as 'CHURCH' | 'MINISTRY' | 'COMMUNITY',
          country: input.country,
          currency: input.currency,
          websiteUrl: input.websiteUrl,
          shortDescription: input.shortDescription,
          logoUrl: input.logoUrl,
        },
      });
      await tx.organizationMembership.create({
        data: {
          userId: req.user.id,
          organizationId: org.id,
          role: 'OWNER',
          acceptedAt: new Date(),
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: req.user.id,
          organizationId: org.id,
          action: 'organization.create',
          targetType: 'organization',
          targetId: org.id,
        },
      });
      return org;
    });
  }
}

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],
})
export class OrganizationsModule {}
