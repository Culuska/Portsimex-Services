import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import ExpenseForm from "../ExpenseForm";
import { updateExpenseAction } from "../actions";

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [expense, vendors, shipments, categories] = await Promise.all([
    prisma.expense.findUnique({ where: { id }, include: { category: true } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, reference: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!expense) notFound();

  const boundUpdate = updateExpenseAction.bind(null, expense.id);

  return (
    <div>
      <PageHeader title={expense.description} description="Expense details" />
      <Card className="max-w-lg">
        <ExpenseForm
          action={boundUpdate}
          vendors={vendors}
          shipments={shipments}
          categories={categories}
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
    </div>
  );
}
