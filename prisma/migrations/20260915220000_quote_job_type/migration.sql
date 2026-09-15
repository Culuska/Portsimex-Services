-- AlterEnum
ALTER TYPE "ShipmentType" ADD VALUE 'CUSTOMS_CLEARANCE';

-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "type" "ShipmentType" NOT NULL DEFAULT 'IMPORT';

