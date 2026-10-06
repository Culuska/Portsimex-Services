-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('CORPORATE', 'NGO', 'INTERNATIONAL_ORGANIZATION', 'GOVERNMENT_RELATED', 'INDIVIDUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('LOGISTICS', 'TRANSPORT', 'GOVERNMENT_TAX', 'VEHICLE', 'IMMIGRATION', 'COMMUNICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'QUOTED', 'APPROVED', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStageStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseBillingType" AS ENUM ('NON_BILLABLE', 'BILLABLE', 'BILLABLE_WITH_MARKUP');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "clientType" "ClientType" NOT NULL DEFAULT 'CORPORATE',
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "creditLimit" DECIMAL(12,2),
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN     "department" TEXT,
ADD COLUMN     "paymentTermsDays" INTEGER,
ADD COLUMN     "taxNumber" TEXT;

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "sourceExpenseId" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "billingType" "ExpenseBillingType" NOT NULL DEFAULT 'NON_BILLABLE',
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "markupAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "service_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL,
    "jobPrefix" TEXT NOT NULL,
    "description" TEXT,
    "slaDays" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "fields" JSONB NOT NULL DEFAULT '[]',
    "reconcileQuantities" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "requestedByName" TEXT,
    "department" TEXT,
    "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requiredBy" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "location" TEXT,
    "assignedDepartment" TEXT,
    "estimatedRevenue" DECIMAL(12,2),
    "estimatedCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "quoteId" TEXT,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_request_lines" (
    "id" TEXT NOT NULL,
    "notes" TEXT,
    "serviceRequestId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "service_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "estimatedRevenue" DECIMAL(12,2),
    "estimatedCost" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "serviceRequestId" TEXT,
    "requestLineId" TEXT,
    "responsibleId" TEXT,
    "shipmentId" TEXT,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_stages" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "requiresDocuments" BOOLEAN NOT NULL DEFAULT false,
    "status" "JobStageStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "jobId" TEXT NOT NULL,
    "completedById" TEXT,

    CONSTRAINT "job_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "dueDate" TIMESTAMP(3),
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" TEXT NOT NULL,
    "assigneeId" TEXT,

    CONSTRAINT "job_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_documents" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "isOutput" BOOLEAN NOT NULL DEFAULT false,
    "received" BOOLEAN NOT NULL DEFAULT false,
    "receivedAt" TIMESTAMP(3),
    "fileUrl" TEXT,
    "fileName" TEXT,
    "reference" TEXT,
    "expiryDate" TIMESTAMP(3),
    "note" TEXT,
    "jobId" TEXT NOT NULL,
    "receivedById" TEXT,

    CONSTRAINT "job_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "reference" TEXT,
    "message" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "actorId" TEXT,
    "actorName" TEXT,
    "jobId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "key" TEXT NOT NULL,
    "value" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_definitions_code_key" ON "service_definitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_requestNumber_key" ON "service_requests"("requestNumber");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_quoteId_key" ON "service_requests"("quoteId");

-- CreateIndex
CREATE INDEX "service_requests_clientId_status_idx" ON "service_requests"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_jobNumber_key" ON "jobs"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_requestLineId_key" ON "jobs"("requestLineId");

-- CreateIndex
CREATE INDEX "jobs_clientId_status_idx" ON "jobs"("clientId", "status");

-- CreateIndex
CREATE INDEX "jobs_serviceId_status_idx" ON "jobs"("serviceId", "status");

-- CreateIndex
CREATE INDEX "jobs_status_dueDate_idx" ON "jobs"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "job_stages_jobId_position_key" ON "job_stages"("jobId", "position");

-- CreateIndex
CREATE INDEX "job_tasks_assigneeId_status_idx" ON "job_tasks"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_jobId_idx" ON "audit_logs"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_items_sourceExpenseId_key" ON "invoice_items"("sourceExpenseId");

-- CreateIndex
CREATE INDEX "invoice_items_jobId_idx" ON "invoice_items"("jobId");

-- CreateIndex
CREATE INDEX "expenses_jobId_idx" ON "expenses"("jobId");

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_sourceExpenseId_fkey" FOREIGN KEY ("sourceExpenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_lines" ADD CONSTRAINT "service_request_lines_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_request_lines" ADD CONSTRAINT "service_request_lines_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_requestLineId_fkey" FOREIGN KEY ("requestLineId") REFERENCES "service_request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_stages" ADD CONSTRAINT "job_stages_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_stages" ADD CONSTRAINT "job_stages_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_tasks" ADD CONSTRAINT "job_tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_documents" ADD CONSTRAINT "job_documents_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Audit trail immutability: audit records can only ever be appended --
-- enforced in the database so no code path (or direct SQL by an app user)
-- can rewrite or remove history.
CREATE OR REPLACE FUNCTION forbid_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit log rows are immutable: % on % is not permitted', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION forbid_audit_mutation();

-- The revenue account now covers every service line, not just freight.
UPDATE "accounts" SET "name" = 'Service Revenue' WHERE "code" = '4000' AND "isSystem" = true AND "name" = 'Freight Revenue';
