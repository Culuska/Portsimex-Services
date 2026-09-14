
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgreementType" ADD VALUE 'SERVICE_AGREEMENT';
ALTER TYPE "AgreementType" ADD VALUE 'FREIGHT_FORWARDING';
ALTER TYPE "AgreementType" ADD VALUE 'RATE_AGREEMENT';
ALTER TYPE "AgreementType" ADD VALUE 'CUSTOMS_BROKERAGE';
ALTER TYPE "AgreementType" ADD VALUE 'WAREHOUSING';
ALTER TYPE "AgreementType" ADD VALUE 'AGENCY';
ALTER TYPE "AgreementType" ADD VALUE 'OPEN_ACCOUNT';

