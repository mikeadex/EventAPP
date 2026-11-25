-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('CLAIMED', 'UNCLAIMED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ClaimTokenKind" AS ENUM ('CLAIM', 'TAKEDOWN');

-- AlterEnum
ALTER TYPE "PlatformRole" ADD VALUE 'PLATFORM_FINANCE';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "addedByUserId" TEXT,
ADD COLUMN     "claimStatus" "ClaimStatus" NOT NULL DEFAULT 'CLAIMED',
ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedSignIns" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TwoFactor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TwoFactor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationClaimToken" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ClaimTokenKind" NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationClaimToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TwoFactor_secret_idx" ON "TwoFactor"("secret");

-- CreateIndex
CREATE INDEX "TwoFactor_userId_idx" ON "TwoFactor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationClaimToken_tokenHash_key" ON "OrganizationClaimToken"("tokenHash");

-- CreateIndex
CREATE INDEX "OrganizationClaimToken_organizationId_kind_idx" ON "OrganizationClaimToken"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "Organization_claimStatus_idx" ON "Organization"("claimStatus");

-- AddForeignKey
ALTER TABLE "TwoFactor" ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationClaimToken" ADD CONSTRAINT "OrganizationClaimToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
