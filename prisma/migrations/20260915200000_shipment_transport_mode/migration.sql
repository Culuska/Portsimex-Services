-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('SEA', 'AIR', 'ROAD');

-- AlterTable
ALTER TABLE "shipments" ADD COLUMN     "airwayBill" TEXT,
ADD COLUMN     "billOfLading" TEXT,
ADD COLUMN     "flightCarrier" TEXT,
ADD COLUMN     "transportMode" "TransportMode" NOT NULL DEFAULT 'SEA',
ADD COLUMN     "vehicleType" TEXT;

