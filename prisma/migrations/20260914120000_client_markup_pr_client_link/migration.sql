-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "markupPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "purchase_requests" ADD COLUMN     "clientId" TEXT;

-- AlterTable
ALTER TABLE "quote_items" ADD COLUMN     "purchaseRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "quote_items_purchaseRequestId_key" ON "quote_items"("purchaseRequestId");

-- AddForeignKey
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

