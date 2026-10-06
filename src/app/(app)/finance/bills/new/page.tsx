import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, PageHeader } from "@/components/ui";
import { attributableJobs } from "@/lib/jobs";
import { financeViewer } from "@/lib/finance-access";
import BillForm from "../BillForm";
import { createBillAction } from "../../actions";

const SUGGESTED = ["Transport", "Fuel", "Customs", "Port", "Government fees", "Ministry processing", "Immigration fees", "Vehicle rental cost", "Vehicle maintenance", "Driver allowance", "Accommodation", "Communication", "SIM / telecom cost", "Supplier charges", "Courier", "Office expenses", "Bank charges", "Other"];

export default async function NewBillPage({ searchParams }: { searchParams: Promise<{ vendor?: string }> }) {
  const viewer = await financeViewer();
  if (!viewer.isStaff) redirect("/");
  const { vendor } = await searchParams;
  const [vendors, jobs, categories] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    attributableJobs(prisma),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const names = [...new Set([...SUGGESTED, ...categories.map((c) => c.name)])];
  return (
    <div>
      <PageHeader title="Record supplier bill" description="Enter the supplier's invoice. Each line becomes a cost on the job it belongs to, owed to the supplier until paid." />
      <Card className="max-w-4xl">
        {vendors.length === 0 ? (
          <p className="text-sm text-zinc-500">Add the supplier under Vendors first.</p>
        ) : (
          <BillForm action={createBillAction} vendors={vendors} jobs={jobs} categories={names} defaultVendorId={vendor} />
        )}
      </Card>
    </div>
  );
}
