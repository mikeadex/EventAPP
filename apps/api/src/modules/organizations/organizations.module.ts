import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuthGuard, AuthedRequest } from '../auth/auth.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { OrgScope, RequirePermissions } from '../../common/decorators.js';
import {
  OrgMembershipGuard,
  type AuthedOrgRequest,
} from '../../common/org-membership.guard.js';
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  Permission,
  checkContent,
  isReadyForReview,
  type CreateOrganizationInput,
} from '@ekklesia/shared';

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

  /**
   * Edit an organisation. Until this existed, nothing about a host could be
   * changed after creation — not its name, its description or its logo — from
   * any client, which also meant a host who skipped the verification questions
   * had no way back into the review queue.
   *
   * `slug` and `country` are not editable: the slug is the organisation's
   * permanent public address, and the country decides which rules it is
   * reviewed under.
   */
  @Patch(':orgId')
  @UseGuards(OrgMembershipGuard)
  @OrgScope('param:orgId')
  @RequirePermissions(Permission.ORG_UPDATE)
  async update(
    @Param('orgId') orgId: string,
    @Req() req: AuthedOrgRequest,
    @Body() body: unknown,
  ) {
    const input = UpdateOrganizationSchema.parse(body);

    const current = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
        shortDescription: true,
        description: true,
        contactName: true,
        contactEmail: true,
        addressLine1: true,
        city: true,
        verificationStatus: true,
      },
    });
    if (!current) throw new NotFoundException('Organization not found');

    // Screened like an event listing is, and for the same reason: a host's
    // name and description are public text somebody else has to read.
    const screened = checkContent(
      input.name ?? current.name,
      input.shortDescription ?? current.shortDescription,
      input.description ?? current.description,
    );
    if (!screened.ok) {
      throw new BadRequestException(
        `This cannot be saved because of the wording: ${screened.matched.join(', ')}. Please edit it, or contact us if you think this is wrong.`,
      );
    }

    // Readiness is judged on the merged result, not on the patch. Someone
    // supplying the one field they left blank last time has now answered all
    // four, and should enter the queue on this request.
    const merged = {
      contactName: input.contactName ?? current.contactName ?? undefined,
      contactEmail: input.contactEmail ?? current.contactEmail ?? undefined,
      addressLine1: input.addressLine1 ?? current.addressLine1 ?? undefined,
      city: input.city ?? current.city ?? undefined,
    };
    // Only ever UNVERIFIED -> PENDING. Editing a description must not drop a
    // verified host back into the queue, and must not let a suspended one out
    // of it; every other transition belongs to a reviewer.
    const entersQueue =
      current.verificationStatus === 'UNVERIFIED' && isReadyForReview(merged);

    const updated = await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.kind !== undefined && {
          kind: input.kind.toUpperCase() as 'CHURCH' | 'MINISTRY' | 'COMMUNITY',
        }),
        ...(input.currency !== undefined && { currency: input.currency }),
        ...(input.websiteUrl !== undefined && { websiteUrl: input.websiteUrl }),
        ...(input.shortDescription !== undefined && {
          shortDescription: input.shortDescription,
        }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.contactName !== undefined && { contactName: input.contactName }),
        ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
        ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
        ...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
        ...(entersQueue && {
          verificationStatus: 'PENDING' as const,
          verificationSubmittedAt: new Date(),
        }),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId: req.user.id,
        organizationId: orgId,
        action: 'organization.update',
        targetType: 'organization',
        targetId: orgId,
        // Field names only. The funnel wants to know what hosts come back to
        // change; it has no business keeping a copy of the values.
        metadata: { fields: Object.keys(input), enteredReviewQueue: entersQueue },
      },
    });

    return updated;
  }

  private async createInTransaction(req: AuthedRequest, input: CreateOrganizationInput) {
    return this.prisma.$transaction(async (tx) => {
      // A host that has answered the verification questions enters the review
      // queue; one that has not stays UNVERIFIED. Nobody self-certifies as
      // VERIFIED — that transition belongs to a reviewer.
      const readyForReview = isReadyForReview(input);

      const org = await tx.organization.create({
        data: {
          slug: input.slug,
          name: input.name,
          kind: input.kind.toUpperCase() as 'CHURCH' | 'MINISTRY' | 'COMMUNITY',
          country: input.country,
          currency: input.currency,
          websiteUrl: input.websiteUrl,
          shortDescription: input.shortDescription,
          description: input.description,
          logoUrl: input.logoUrl,
          contactName: input.contactName,
          contactEmail: input.contactEmail,
          contactPhone: input.contactPhone,
          addressLine1: input.addressLine1,
          city: input.city,
          postalCode: input.postalCode,
          ...(readyForReview && {
            verificationStatus: 'PENDING' as const,
            verificationSubmittedAt: new Date(),
          }),
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
