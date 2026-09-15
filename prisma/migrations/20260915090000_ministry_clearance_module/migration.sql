
-- CreateEnum
CREATE TYPE "ApprovalStepStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CORRECTION_REQUESTED');

-- CreateEnum
CREATE TYPE "ApprovalActionType" AS ENUM ('APPROVE', 'REJECT', 'REQUEST_CORRECTION');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('NOT_STARTED', 'IN_REVIEW', 'AWAITING_VENDOR_CORRECTION', 'CLEARED_FOR_DELIVERY', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('AIRPORT', 'SEAPORT');

-- CreateEnum
CREATE TYPE "DeliveryRecordStatus" AS ENUM ('PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('CORRECTION_REQUESTED', 'MINISTRY_ACTION_TAKEN', 'SHIPMENT_CLEARED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'MINISTRY_REGISTRAR';
ALTER TYPE "Role" ADD VALUE 'MINISTRY_OFFICER';
ALTER TYPE "Role" ADD VALUE 'VENDOR';
ALTER TYPE "Role" ADD VALUE 'LOGISTICS_STAFF';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ministryId" TEXT,
ADD COLUMN     "vendorClientId" TEXT;

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "clearanceStatus" "ClearanceStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "ministries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultPosition" INTEGER,
    "requiredDocumentTypes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ministries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ministry_chain_steps" (
    "id" TEXT NOT NULL,
    "shipmentType" "ShipmentType" NOT NULL,
    "position" INTEGER NOT NULL,
    "ministryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ministry_chain_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_documents" (
    "id" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipmentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "clearance_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clearance_document_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "clearance_document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "ApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipmentId" TEXT NOT NULL,
    "ministryId" TEXT NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_actions" (
    "id" TEXT NOT NULL,
    "action" "ApprovalActionType" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stepId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "documentVersionId" TEXT,

    CONSTRAINT "approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_records" (
    "id" TEXT NOT NULL,
    "deliveryMode" "DeliveryMode" NOT NULL,
    "destinationDetail" TEXT NOT NULL,
    "status" "DeliveryRecordStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shipmentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "delivery_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "message" TEXT NOT NULL,
    "shipmentId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ministries_code_key" ON "ministries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ministry_chain_steps_shipmentType_ministryId_key" ON "ministry_chain_steps"("shipmentType", "ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "ministry_chain_steps_shipmentType_position_key" ON "ministry_chain_steps"("shipmentType", "position");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_document_versions_documentId_version_key" ON "clearance_document_versions"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_shipmentId_ministryId_key" ON "approval_steps"("shipmentId", "ministryId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_records_shipmentId_key" ON "delivery_records"("shipmentId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "ministries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vendorClientId_fkey" FOREIGN KEY ("vendorClientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ministry_chain_steps" ADD CONSTRAINT "ministry_chain_steps_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "ministries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_documents" ADD CONSTRAINT "clearance_documents_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_documents" ADD CONSTRAINT "clearance_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_document_versions" ADD CONSTRAINT "clearance_document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "clearance_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clearance_document_versions" ADD CONSTRAINT "clearance_document_versions_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_ministryId_fkey" FOREIGN KEY ("ministryId") REFERENCES "ministries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "approval_steps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_actions" ADD CONSTRAINT "approval_actions_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "clearance_document_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_records" ADD CONSTRAINT "delivery_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

