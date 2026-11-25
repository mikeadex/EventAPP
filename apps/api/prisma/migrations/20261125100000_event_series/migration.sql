-- CreateEnum
CREATE TYPE "SeriesRule" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rule" "SeriesRule" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "count" INTEGER,
    "until" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Event" ADD COLUMN "seriesId" TEXT;

-- CreateIndex
CREATE INDEX "EventSeries_organizationId_idx" ON "EventSeries"("organizationId");

-- CreateIndex
CREATE INDEX "Event_seriesId_idx" ON "Event"("seriesId");

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
