import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { attributableJobs } from "@/lib/jobs";
import { activeMoneyAccounts } from "@/lib/finance";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui";
import ExpenseForm from "../ExpenseForm";
import { createExpenseAction } from "../actions";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string; jobId?: string }>;
}) {
  await requirePermission("expenses.create");
  const { shipmentId, jobId } = await searchParams;
  const [vendors, shipments, categories, jobs, moneyAccounts] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    attributableJobs(prisma),
    activeMoneyAccounts(),
  ]);

  return (
    <div>
      <PageHeader title="New expense" description="Every operational cost should be linked to the job it was spent on." />
      <ExpenseForm
        action={createExpenseAction}
        vendors={vendors}
        shipments={shipments}
        categories={categories}
        jobs={jobs}
        moneyAccounts={moneyAccounts}
        allowReceipt
        approvalThreshold={(await getSettings()).expenseApprovalThreshold}
        defaultValues={
          shipmentId || jobId
            ? {
                description: "",
                amount: "",
                categoryName: "",
                vendorId: null,
                shipmentId: shipmentId ?? null,
                status: "PENDING",
                incurredAt: new Date(),
                jobId: jobId ?? null,
              }
            : undefined
        }
        submitLabel="Create expense"
      />
    </div>
  );
}
