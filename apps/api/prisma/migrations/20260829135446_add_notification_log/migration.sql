-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_eventId_kind_idx" ON "NotificationLog"("eventId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_eventId_kind_key" ON "NotificationLog"("userId", "eventId", "kind");
