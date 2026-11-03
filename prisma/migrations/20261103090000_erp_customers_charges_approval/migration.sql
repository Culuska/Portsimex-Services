-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ChargeGroup" AS ENUM ('AIRPORT', 'SEAPORT', 'FREIGHT', 'TRANSPORT', 'CUSTOMS', 'DOCUMENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "HandlingKind" AS ENUM ('AIRPORT', 'SEAPORT');

-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('AWAITING_ARRIVAL', 'ARRIVED', 'CHARGES_PAID', 'RELEASED', 'ON_HOLD');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'APPROVAL_NEEDED';

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "registrationNumber" TEXT,
ADD COLUMN     "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "statusReason" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "approvalRequestedAt" TIMESTAMP(3),
ADD COLUMN     "approvalRequestedById" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "chargeTypeId" TEXT;

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "invoiceApprovalThreshold" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charge_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "ChargeGroup" NOT NULL,
    "vendorId" TEXT,
    "markupPercent" DECIMAL(7,2),
    "fixedPrice" DECIMAL(12,2),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "charge_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handling_records" (
    "id" TEXT NOT NULL,
    "kind" "HandlingKind" NOT NULL,
    "reference" TEXT,
    "transportDocNo" TEXT,
    "carrier" TEXT,
    "vesselOrFlight" TEXT,
    "containerNumbers" TEXT,
    "containerType" TEXT,
    "packages" INTEGER,
    "weightKg" DECIMAL(12,2),
    "cargoDescription" TEXT,
    "arrivalDate" TIMESTAMP(3),
    "releaseStatus" "ReleaseStatus" NOT NULL DEFAULT 'AWAITING_ARRIVAL',
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT NOT NULL,
    "vendorId" TEXT,

    CONSTRAINT "handling_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "client_contacts_clientId_idx" ON "client_contacts"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "charge_types_code_key" ON "charge_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "handling_records_jobId_kind_key" ON "handling_records"("jobId", "kind");

-- CreateIndex
CREATE INDEX "expenses_chargeTypeId_idx" ON "expenses"("chargeTypeId");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approvalRequestedById_fkey" FOREIGN KEY ("approvalRequestedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_chargeTypeId_fkey" FOREIGN KEY ("chargeTypeId") REFERENCES "charge_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "charge_types" ADD CONSTRAINT "charge_types_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handling_records" ADD CONSTRAINT "handling_records_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handling_records" ADD CONSTRAINT "handling_records_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

