-- CreateEnum
CREATE TYPE "MoneyAccountKind" AS ENUM ('CASH', 'BANK', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "AdvanceSource" AS ENUM ('DEPOSIT', 'OVERPAYMENT');

-- CreateEnum
CREATE TYPE "SupplierBillStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LedgerSourceType" ADD VALUE 'INVOICE_REVERSAL';
ALTER TYPE "LedgerSourceType" ADD VALUE 'EXPENSE_REVERSAL';
ALTER TYPE "LedgerSourceType" ADD VALUE 'ADVANCE_RECEIPT';
ALTER TYPE "LedgerSourceType" ADD VALUE 'ADVANCE_REFUND';
ALTER TYPE "LedgerSourceType" ADD VALUE 'SUPPLIER_PAYMENT';
ALTER TYPE "LedgerSourceType" ADD VALUE 'TRANSFER';

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ADVANCE';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "revenueReversedAt" TIMESTAMP(3),
ADD COLUMN     "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "advanceId" TEXT,
ADD COLUMN     "moneyAccountId" TEXT;

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "accrualReversedAt" TIMESTAMP(3),
ADD COLUMN     "expenseNumber" TEXT,
ADD COLUMN     "paidFromId" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "receiptName" TEXT,
ADD COLUMN     "receiptUrl" TEXT,
ADD COLUMN     "supplierBillId" TEXT;

-- AlterTable
ALTER TABLE "ledger_transactions" ADD COLUMN     "advanceId" TEXT,
ADD COLUMN     "refundId" TEXT,
ADD COLUMN     "supplierPaymentId" TEXT,
ADD COLUMN     "transferId" TEXT;

-- CreateTable
CREATE TABLE "money_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "MoneyAccountKind" NOT NULL DEFAULT 'BANK',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "money_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "money_transfers" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "transferredAt" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,

    CONSTRAINT "money_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_advances" (
    "id" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "notes" TEXT,
    "source" "AdvanceSource" NOT NULL DEFAULT 'DEPOSIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientId" TEXT NOT NULL,
    "jobId" TEXT,
    "moneyAccountId" TEXT,
    "sourceInvoiceId" TEXT,

    CONSTRAINT "client_advances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_refunds" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refundedAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "advanceId" TEXT NOT NULL,
    "moneyAccountId" TEXT,

    CONSTRAINT "advance_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_bills" (
    "id" TEXT NOT NULL,
    "billNumber" TEXT NOT NULL,
    "supplierReference" TEXT,
    "billDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "SupplierBillStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vendorId" TEXT NOT NULL,

    CONSTRAINT "supplier_bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_TRANSFER',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "billId" TEXT NOT NULL,
    "moneyAccountId" TEXT,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "money_accounts_name_key" ON "money_accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "money_accounts_accountId_key" ON "money_accounts"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "client_advances_advanceNumber_key" ON "client_advances"("advanceNumber");

-- CreateIndex
CREATE INDEX "client_advances_clientId_idx" ON "client_advances"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_bills_billNumber_key" ON "supplier_bills"("billNumber");

-- CreateIndex
CREATE INDEX "supplier_bills_vendorId_status_idx" ON "supplier_bills"("vendorId", "status");

-- CreateIndex
CREATE INDEX "payments_advanceId_idx" ON "payments"("advanceId");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expenseNumber_key" ON "expenses"("expenseNumber");

-- CreateIndex
CREATE INDEX "expenses_supplierBillId_idx" ON "expenses"("supplierBillId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_refundId_key" ON "ledger_transactions"("refundId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_supplierPaymentId_key" ON "ledger_transactions"("supplierPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_transferId_key" ON "ledger_transactions"("transferId");

-- CreateIndex
CREATE INDEX "ledger_transactions_transactionDate_idx" ON "ledger_transactions"("transactionDate");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "money_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "client_advances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_paidFromId_fkey" FOREIGN KEY ("paidFromId") REFERENCES "money_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierBillId_fkey" FOREIGN KEY ("supplierBillId") REFERENCES "supplier_bills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "client_advances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "advance_refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "supplier_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "money_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_accounts" ADD CONSTRAINT "money_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_transfers" ADD CONSTRAINT "money_transfers_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "money_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "money_transfers" ADD CONSTRAINT "money_transfers_toId_fkey" FOREIGN KEY ("toId") REFERENCES "money_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_advances" ADD CONSTRAINT "client_advances_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_advances" ADD CONSTRAINT "client_advances_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_advances" ADD CONSTRAINT "client_advances_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "money_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_advances" ADD CONSTRAINT "client_advances_sourceInvoiceId_fkey" FOREIGN KEY ("sourceInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_refunds" ADD CONSTRAINT "advance_refunds_advanceId_fkey" FOREIGN KEY ("advanceId") REFERENCES "client_advances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_refunds" ADD CONSTRAINT "advance_refunds_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "money_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_bills" ADD CONSTRAINT "supplier_bills_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_billId_fkey" FOREIGN KEY ("billId") REFERENCES "supplier_bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_moneyAccountId_fkey" FOREIGN KEY ("moneyAccountId") REFERENCES "money_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

