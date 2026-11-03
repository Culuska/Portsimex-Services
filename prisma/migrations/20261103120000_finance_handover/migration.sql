-- CreateEnum
CREATE TYPE "FinanceStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING_REVIEW', 'UNDER_REVIEW', 'RETURNED', 'ACCEPTED', 'AMENDMENT_REQUESTED', 'FINANCIALLY_CLOSED');

-- CreateEnum
CREATE TYPE "HandoverKind" AS ENUM ('SUBMISSION', 'AMENDMENT');

-- CreateEnum
CREATE TYPE "HandoverOutcome" AS ENUM ('PENDING', 'ACCEPTED', 'RETURNED', 'AMENDMENT_APPROVED', 'AMENDMENT_DECLINED');

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "financeStatus" "FinanceStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';

-- CreateTable
CREATE TABLE "finance_handovers" (
    "id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "kind" "HandoverKind" NOT NULL DEFAULT 'SUBMISSION',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedById" TEXT,
    "note" TEXT,
    "confirmations" JSONB NOT NULL DEFAULT '[]',
    "serviceCharges" JSONB NOT NULL DEFAULT '[]',
    "billingTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "costTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "outcome" "HandoverOutcome" NOT NULL DEFAULT 'PENDING',
    "reviewStartedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "returnReason" TEXT,
    "requiredCorrections" TEXT,
    "correctionDeadline" TIMESTAMP(3),
    "returnedToId" TEXT,
    "serviceChargesInvoiceId" TEXT,
    "jobId" TEXT NOT NULL,

    CONSTRAINT "finance_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "finance_handovers_outcome_submittedAt_idx" ON "finance_handovers"("outcome", "submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_handovers_jobId_round_key" ON "finance_handovers"("jobId", "round");

-- AddForeignKey
ALTER TABLE "finance_handovers" ADD CONSTRAINT "finance_handovers_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_handovers" ADD CONSTRAINT "finance_handovers_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_handovers" ADD CONSTRAINT "finance_handovers_returnedToId_fkey" FOREIGN KEY ("returnedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_handovers" ADD CONSTRAINT "finance_handovers_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill: jobs already closed are financially closed; completed jobs that
-- were already invoiced before this workflow existed count as accepted.
UPDATE "jobs" SET "financeStatus" = 'FINANCIALLY_CLOSED' WHERE "status" = 'CLOSED';
UPDATE "jobs" SET "financeStatus" = 'ACCEPTED'
WHERE "status" = 'COMPLETED' AND EXISTS (SELECT 1 FROM "invoice_items" ii WHERE ii."jobId" = "jobs"."id");
