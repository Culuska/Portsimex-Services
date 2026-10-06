-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW_UP_DUE';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENT_EXPIRING';
ALTER TYPE "NotificationType" ADD VALUE 'TASK_OVERDUE';
ALTER TYPE "NotificationType" ADD VALUE 'JOB_OVERDUE';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "jobId" TEXT;

-- AlterTable
ALTER TABLE "job_documents" ADD COLUMN     "waived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "waivedReason" TEXT;

-- CreateTable
CREATE TABLE "government_agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "office" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "location" TEXT,
    "services" TEXT,
    "referenceRequirements" TEXT,
    "notes" TEXT,
    "followUpDays" INTEGER NOT NULL DEFAULT 7,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_submissions" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL,
    "documentsSubmitted" TEXT[],
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "response" TEXT,
    "respondedAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "officerId" TEXT,
    "createdById" TEXT,

    CONSTRAINT "job_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_follow_ups" (
    "id" TEXT NOT NULL,
    "followedUpAt" TIMESTAMP(3) NOT NULL,
    "contact" TEXT,
    "outcome" TEXT NOT NULL,
    "nextAction" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionId" TEXT NOT NULL,
    "byId" TEXT,

    CONSTRAINT "job_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_submissions_jobId_idx" ON "job_submissions"("jobId");

-- CreateIndex
CREATE INDEX "job_submissions_status_nextFollowUpAt_idx" ON "job_submissions"("status", "nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupeKey_key" ON "notifications"("dedupeKey");

-- AddForeignKey
ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "government_agencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_submissions" ADD CONSTRAINT "job_submissions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_follow_ups" ADD CONSTRAINT "job_follow_ups_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "job_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_follow_ups" ADD CONSTRAINT "job_follow_ups_byId_fkey" FOREIGN KEY ("byId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

