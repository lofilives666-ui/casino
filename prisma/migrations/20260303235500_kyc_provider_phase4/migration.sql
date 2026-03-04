-- AlterTable
ALTER TABLE "KycSubmission"
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerCaseId" TEXT,
ADD COLUMN     "providerStatus" TEXT,
ADD COLUMN     "amlStatus" TEXT,
ADD COLUMN     "riskLevel" TEXT,
ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "amlFlags" JSONB;

-- CreateTable
CREATE TABLE "KycProviderEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycProviderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KycSubmission_provider_providerCaseId_idx" ON "KycSubmission"("provider", "providerCaseId");

-- CreateIndex
CREATE UNIQUE INDEX "KycProviderEvent_provider_providerEventId_key" ON "KycProviderEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "KycProviderEvent_processedAt_idx" ON "KycProviderEvent"("processedAt" DESC);

