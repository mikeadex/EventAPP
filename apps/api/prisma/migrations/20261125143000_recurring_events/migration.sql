-- CreateEnum
CREATE TYPE "RecurrenceFreq" AS ENUM ('WEEKLY', 'FORTNIGHTLY', 'MONTHLY_BY_DATE', 'MONTHLY_BY_WEEKDAY');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "seriesLead" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "freq" "RecurrenceFreq" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "byWeekday" INTEGER[],
    "nthWeekday" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timezone" TEXT NOT NULL,
    "until" TIMESTAMP(3),
    "count" INTEGER,
    "generatedUntil" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventSeries_organizationId_idx" ON "EventSeries"("organizationId");

-- CreateIndex
CREATE INDEX "EventSeries_generatedUntil_idx" ON "EventSeries"("generatedUntil");

-- CreateIndex
CREATE INDEX "Event_status_visibility_seriesLead_startsAt_idx" ON "Event"("status", "visibility", "seriesLead", "startsAt");

-- CreateIndex
CREATE INDEX "Event_seriesId_startsAt_idx" ON "Event"("seriesId", "startsAt");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries" ADD CONSTRAINT "EventSeries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

