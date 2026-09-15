import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canManageMinistries } from "@/lib/permissions";
import { Card, PageHeader } from "@/components/ui";
import ChainEditor from "./ChainEditor";

const SHIPMENT_TYPES = ["IMPORT", "EXPORT", "TRANSSHIPMENT", "DOMESTIC"] as const;

export default async function ChainsPage() {
  const session = await auth();
  if (!session || !canManageMinistries(session.user.role)) {
    redirect("/");
  }

  const [ministries, chainSteps] = await Promise.all([
    prisma.ministry.findMany({ orderBy: { name: "asc" } }),
    prisma.ministryChainStep.findMany({
      orderBy: { position: "asc" },
      include: { ministry: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Approval chains"
        description="Set the ordered ministry sequence each shipment type must clear, in order."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {SHIPMENT_TYPES.map((type) => {
          const initialChain = chainSteps
            .filter((s) => s.shipmentType === type)
            .map((s) => ({ id: s.ministryId, name: s.ministry.name }));
          return (
            <Card key={type}>
              <h2 className="mb-4 font-semibold text-zinc-900 dark:text-zinc-50">{type}</h2>
              <ChainEditor
                shipmentType={type}
                allMinistries={ministries}
                initialChain={initialChain}
              />
            </Card>
          );
        })}
      </div>
    </div>
  );
}
