import { canApproveAmount } from "@/lib/permission-catalog";
import { requirePermission } from "@/lib/session";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { attributableJobs } from "@/lib/jobs";
import { isExpenseBilled, type InvoiceStatus } from "@/lib/job-finance";
import { PageHeader, Card, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import { activeMoneyAccounts, PAYMENT_METHOD_LABELS } from "@/lib/finance";
import { getSettings } from "@/lib/settings";
import { fieldClass } from "@/components/ActionForm";
import ExpenseForm from "../ExpenseForm";
import RejectExpenseForm from "../RejectExpenseForm";
import {
  approveExpenseAction,
  payExpenseAction,
  rejectExpenseAction,
  updateExpenseAction,
} from "../actions";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, expense, vendors, shipments, categories, moneyAccounts] = await Promise.all([
    requirePermission("expenses.view"),
    prisma.expense.findUnique({
      where: { id },
      include: { category: true, approvedBy: true, job: true, invoiceItem: { include: { invoice: true } }, paidFrom: true, supplierBill: true },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    activeMoneyAccounts(),
  ]);

  if (!expense) notFound();
  const jobs = await attributableJobs(prisma, undefined, expense.jobId);
  const billed = isExpenseBilled((expense.invoiceItem?.invoice.status as InvoiceStatus | undefined) ?? null);

  const settings = await getSettings();
  // Shown the approve / reject buttons only within this user's approval limit.
  const isAdmin = canApproveAmount(session.grant, Number(expense.amount));
  const boundUpdate = updateExpenseAction.bind(null, expense.id);
  const boundApprove = approveExpenseAction.bind(null, expense.id);
  const boundReject = rejectExpenseAction.bind(null, expense.id);
  const boundPay = payExpenseAction.bind(null, expense.id);

  return (
    <div>
      <PageHeader
        title={expense.description}
        description={`${expense.expenseNumber ? `${expense.expenseNumber} · ` : ""}${expense.job ? `Expense on ${expense.job.jobNumber}` : "Expense details"}`}
        action={<Badge status={expense.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="max-w-lg">
          <ExpenseForm
            action={boundUpdate}
            vendors={vendors}
            shipments={shipments}
            categories={categories}
            jobs={jobs}
            lockBilling={billed}
            lockAmount
            lockStatus={expense.status !== "PENDING" || !!expense.supplierBillId}
            moneyAccounts={moneyAccounts}
            approvalThreshold={settings.expenseApprovalThreshold}
            defaultValues={{
              description: expense.description,
              amount: expense.amount.toString(),
              categoryName: expense.category.name,
              vendorId: expense.vendorId,
              shipmentId: expense.shipmentId,
              status: expense.status,
              incurredAt: expense.incurredAt,
              jobId: expense.jobId,
              billingType: expense.billingType,
              markupAmount: expense.markupAmount.toString(),
            }}
            submitLabel="Save changes"
          />
          {(expense.supplierBill || expense.receiptUrl) && (
            <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-500 dark:border-zinc-800">
              {expense.supplierBill && (
                <>
                  Line on supplier bill{" "}
                  <Link href={`/finance/bills/${expense.supplierBill.id}`} className="text-brand-600 hover:underline">
                    {expense.supplierBill.billNumber}
                  </Link>{" "}
                  -- paid through the bill.{" "}
                </>
              )}
              {expense.receiptUrl && (
                <a href={expense.receiptUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                  View receipt{expense.receiptName ? ` (${expense.receiptName})` : ""}
                </a>
              )}
            </p>
          )}
          {(expense.job || expense.invoiceItem) && (
            <p className="mt-4 border-t border-zinc-100 pt-3 text-sm text-zinc-500 dark:border-zinc-800">
              {expense.job && (
                <>Job: <Link href={`/jobs/${expense.job.id}`} className="text-brand-600 hover:underline">{expense.job.jobNumber}</Link>. </>
              )}
              {expense.invoiceItem && (
                <>Re-charged on <Link href={`/invoices/${expense.invoiceItem.invoice.id}`} className="text-brand-600 hover:underline">{expense.invoiceItem.invoice.invoiceNumber}</Link> ({expense.invoiceItem.invoice.status.toLowerCase()}).</>
              )}
            </p>
          )}
        </Card>

        {expense.status !== "PENDING" && (
          <Card className="flex flex-col gap-4">
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Approval</h2>

            {expense.status === "PENDING_APPROVAL" && (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  {formatCurrency(expense.amount.toString())} exceeds the {formatCurrency(settings.expenseApprovalThreshold)} approval threshold and needs
                  managerial approval before it can be paid.
                </p>
                {isAdmin ? (
                  <div className="flex flex-col gap-3">
                    <form action={boundApprove}>
                      <button
                        type="submit"
                        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                      >
                        Approve
                      </button>
                    </form>
                    <RejectExpenseForm action={boundReject} />
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">Waiting for a manager whose approval limit covers this amount.</p>
                )}
              </>
            )}

            {expense.status === "APPROVED" && (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Approved by {expense.approvedBy?.name ?? "—"} on {formatDate(expense.approvedAt)}.
                  Ready to pay out.
                </p>
                {expense.supplierBill ? (
                  <p className="text-sm text-zinc-500">
                    Pay it through bill{" "}
                    <Link href={`/finance/bills/${expense.supplierBill.id}`} className="text-brand-600 hover:underline">
                      {expense.supplierBill.billNumber}
                    </Link>
                    .
                  </p>
                ) : (
                  <form action={boundPay} className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                      Paid from
                      <select name="paidFromId" className={fieldClass}>
                        {moneyAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
                      Method
                      <select name="paymentMethod" defaultValue="BANK_TRANSFER" className={fieldClass}>
                        {["BANK_TRANSFER", "CASH", "MOBILE_MONEY", "CARD", "CHECK", "OTHER"].map((m) => (
                          <option key={m} value={m}>
                            {PAYMENT_METHOD_LABELS[m]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="submit"
                      className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                    >
                      Mark paid
                    </button>
                  </form>
                )}
              </>
            )}

            {expense.status === "REJECTED" && (
              <p className="text-sm text-red-600 dark:text-red-400">
                Rejected by {expense.approvedBy?.name ?? "—"} on {formatDate(expense.approvedAt)}:{" "}
                {expense.rejectedReason}
              </p>
            )}

            {expense.status === "PAID" && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Paid on {formatDate(expense.paidAt)}
                {expense.paidFrom ? ` from ${expense.paidFrom.name}` : ""}
                {expense.paymentMethod ? ` (${PAYMENT_METHOD_LABELS[expense.paymentMethod]})` : ""}
                {expense.supplierBill ? ` through bill ${expense.supplierBill.billNumber}` : ""}.
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
