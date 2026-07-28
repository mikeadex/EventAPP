-- DropForeignKey
ALTER TABLE "ModerationAction" DROP CONSTRAINT "ModerationAction_actorUserId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reportedByUserId_fkey";

-- AlterTable
ALTER TABLE "ModerationAction" ALTER COLUMN "actorUserId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Report" ALTER COLUMN "reportedByUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
