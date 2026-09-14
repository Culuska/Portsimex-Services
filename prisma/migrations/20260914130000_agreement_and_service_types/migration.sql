
-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('CLOSED', 'NON_DISCLOSED');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('CUSTOMS_CLEARANCE', 'IMPORT', 'EXPORT', 'IMMIGRATION_SUPPORT', 'EXPEDITION', 'TRANSPORTATION', 'TOPUPS', 'EMPLOYMENT_PAYMENT');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "agreementType" "AgreementType",
ADD COLUMN     "services" "ServiceType"[];

-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "serviceType" "ServiceType";

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "serviceType" "ServiceType";

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "serviceType" "ServiceType";

