
-- AlterTable
ALTER TABLE "clients" DROP COLUMN "markupPercent";

-- CreateTable
CREATE TABLE "client_service_rates" (
    "id" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "markupPercent" DECIMAL(5,2) NOT NULL,
    "clientId" TEXT NOT NULL,

    CONSTRAINT "client_service_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_service_rates_clientId_serviceType_key" ON "client_service_rates"("clientId", "serviceType");

-- AddForeignKey
ALTER TABLE "client_service_rates" ADD CONSTRAINT "client_service_rates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

