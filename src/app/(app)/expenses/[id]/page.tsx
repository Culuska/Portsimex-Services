import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { attributableJobs } from "@/lib/jobs";
import { isExpenseBilled, type InvoiceStatus } from "@/lib/job-finance";
import { auth } from "@/auth";
import { isFullAccessRole } from "@/lib/roles";
import { PageHeader, Card, Badge } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
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
  const [session, expense, vendors, shipments, categories] = await Promise.all([
    auth(),
    prisma.expense.findUnique({
      where: { id },
      include: { category: true, approvedBy: true, job: true, invoiceItem: { include: { invoice: true } } },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!expense) notFound();
  const jobs = await attributableJobs(prisma, undefined, expense.jobId);
  const billed = isExpenseBilled((expense.invoiceItem?.invoice.status as InvoiceStatus | undefined) ?? null);

  const isAdmin = !!session && isFullAccessRole(session.user.role);
  const boundUpdate = updateExpenseAction.bind(null, expense.id);
  const boundApprove = approveExpenseAction.bind(null, expense.id);
  const boundReject = rejectExpenseAction.bind(null, expense.id);
  const boundPay = payExpenseAction.bind(null, expense.id);

  return (
    <div>
      <PageHeader
        title={expense.description}
        description={expense.job ? `Expense on ${expense.job.jobNumber}` : "Expense details"}
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
            lockStatus={expense.status !== "PENDING"}
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
                  {formatCurrency(expense.amount.toString())} exceeds the $500 auto-pay threshold and needs
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
                  <p className="text-sm text-zinc-500">Waiting on an admin to approve or reject.</p>
                )}
              </>
            )}

            {expense.status === "APPROVED" && (
              <>
                <p className="text-sm text-zinc-600 dark:text-zinc-300">
                  Approved by {expense.approvedBy?.name ?? "—"} on {formatDate(expense.approvedAt)}.
                  Ready to pay out.
                </p>
                <form action={boundPay}>
                  <button
                    type="submit"
                    className="w-fit rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                  >
                    Mark paid
                  </button>
                </form>
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
                Paid on {formatDate(expense.paidAt)}.
              </p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
