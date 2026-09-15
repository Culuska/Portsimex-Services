import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
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
      include: { category: true, approvedBy: true },
    }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!expense) notFound();

  const isAdmin = session?.user.role === "ADMIN";
  const boundUpdate = updateExpenseAction.bind(null, expense.id);
  const boundApprove = approveExpenseAction.bind(null, expense.id);
  const boundReject = rejectExpenseAction.bind(null, expense.id);
  const boundPay = payExpenseAction.bind(null, expense.id);

  return (
    <div>
      <PageHeader
        title={expense.description}
        description="Expense details"
        action={<Badge status={expense.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="max-w-lg">
          <ExpenseForm
            action={boundUpdate}
            vendors={vendors}
            shipments={shipments}
            categories={categories}
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
            }}
            submitLabel="Save changes"
          />
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
