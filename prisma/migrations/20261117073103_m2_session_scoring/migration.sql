-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "finalizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Tenant" ALTER COLUMN "settings" SET DEFAULT '{"heightThresholdMeters": 1.8, "timezone": "Asia/Jakarta", "scoringWeights": {"documentCompleteness": 25, "hazardIdentification": 30, "procedureCompliance": 25, "additionalPermitsAndIsolation": 20}}';
