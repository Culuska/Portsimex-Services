import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import ExpenseForm from "../ExpenseForm";
import { createExpenseAction } from "../actions";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ shipmentId?: string }>;
}) {
  const { shipmentId } = await searchParams;
  const [vendors, shipments, categories] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="New expense" />
      <ExpenseForm
        action={createExpenseAction}
        vendors={vendors}
        shipments={shipments}
        categories={categories}
        defaultValues={
          shipmentId
            ? {
                description: "",
                amount: "",
                categoryName: "",
                vendorId: null,
                shipmentId,
                status: "PENDING",
                incurredAt: new Date(),
              }
            : undefined
        }
        submitLabel="Create expense"
      />
    </div>
  );
}
