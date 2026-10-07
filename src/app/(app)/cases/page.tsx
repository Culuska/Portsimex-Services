import { jobScopeWhere, requirePermission } from "@/lib/session";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { detailsOf } from "@/lib/jobs";
import { caseStatusLabel, deriveCaseStatus, type CaseStatus } from "@/lib/case-status";
import { expiryState } from "@/lib/reminder-rules";
import { isSubmissionOpen } from "@/lib/submission-rules";
import { Card, EmptyState, PageHeader } from "@/components/ui";

const TABS = {
  tax: { label: "Tax Exemption", kind: "TAX" as const, where: { service: { jobPrefix: "TAX" } } },
  immigration: { label: "Immigration", kind: "IMMIGRATION" as const, where: { service: { category: "IMMIGRATION" } } },
  government: { label: "Government", kind: "GOVERNMENT" as const, where: { service: { category: "GOVERNMENT_TAX", jobPrefix: { not: "TAX" } } } },
} satisfies Record<string, { label: string; kind: "TAX" | "IMMIGRATION" | "GOVERNMENT"; where: Prisma.JobWhereInput }>;

const STATUS_TONE: Partial<Record<CaseStatus, string>> = {
  DOCUMENTS_PENDING: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  INFO_REQUIRED: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  OUTPUT_RECEIVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  DELIVERED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  CLOSED: "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900",
};

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ t?: string; all?: string }> }) {
  const me = await requirePermission("jobs.view");
  const { t = "tax", all } = await searchParams;
  const key = (t in TABS ? t : "tax") as keyof typeof TABS;
  const tab = TABS[key];

  const jobs = await prisma.job.findMany({
    where: { AND: [tab.where, jobScopeWhere(me)], ...(all ? {} : { status: { notIn: ["CLOSED", "CANCELLED"] } }) },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      client: true,
      service: true,
      responsible: true,
      stages: true,
      documents: true,
      submissions: { orderBy: { submittedAt: "desc" }, include: { agency: true } },
    },
  });
  const counts = await Promise.all(
    (Object.keys(TABS) as (keyof typeof TABS)[]).map(async (k) => [k, await prisma.job.count({ where: { AND: [TABS[k].where, jobScopeWhere(me)], status: { notIn: ["CLOSED", "CANCELLED"] } } })] as const),
  );
  const today = new Date(new Date().setHours(0, 0, 0, 0));

  const rows = jobs.map((j) => {
    const d = detailsOf(j.details);
    const latest = j.submissions[0] ?? null;
    const output = j.documents.find((doc) => doc.isOutput && doc.received);
    const status = deriveCaseStatus({ jobStatus: j.status, docs: j.documents, stages: j.stages, latestSubmission: latest });
    const s = (k: string) => (d[k] === null || d[k] === undefined || d[k] === "" ? null : String(d[k]));
    const expiry = output?.expiryDate ?? (s("documentExpiry") || s("expiryDate") ? new Date((s("documentExpiry") ?? s("expiryDate"))!) : null);
    return { j, d: s, latest, output, status, expiry };
  });

  return (
    <div>
      <PageHeader title="Cases" description="Tax exemption, government and immigration cases -- where each one stands, what was submitted, and when to follow up" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {counts.map(([k, n]) => (
          <Link
            key={k}
            href={`/cases?t=${k}${all ? "&all=1" : ""}`}
            className={`rounded-full px-3 py-1 text-sm ${k === key ? "bg-brand-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-100 dark:bg-zinc-900 dark:text-zinc-300 dark:ring-zinc-800"}`}
          >
            {TABS[k].label} <span className="opacity-70">{n}</span>
          </Link>
        ))}
        <Link href={`/cases?t=${key}${all ? "" : "&all=1"}`} className="ml-auto text-sm text-brand-600 hover:underline">
          {all ? "Show open cases only" : "Include closed & cancelled"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState message={`No ${tab.label.toLowerCase()} cases${all ? "" : " open"}. Cases are opened from a service request.`} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
              <tr>
                <th className="px-3 py-3 font-medium">Case</th>
                <th className="px-3 py-3 font-medium">Client</th>
                {key === "tax" && <th className="px-3 py-3 font-medium">Purchase / tax</th>}
                {key === "immigration" && <th className="px-3 py-3 font-medium">Applicant</th>}
                {key === "government" && <th className="px-3 py-3 font-medium">Service</th>}
                <th className="px-3 py-3 font-medium">{key === "immigration" ? "Office" : "Ministry / agency"}</th>
                <th className="px-3 py-3 font-medium">Submitted</th>
                <th className="px-3 py-3 font-medium">Next follow-up</th>
                <th className="px-3 py-3 font-medium">{key === "tax" ? "Certificate" : key === "immigration" ? "Document" : "Output"}</th>
                <th className="px-3 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map(({ j, d, latest, output, status, expiry }) => {
                const open = latest && isSubmissionOpen(latest.status);
                const late = open && latest.nextFollowUpAt && latest.nextFollowUpAt < today;
                const exp = expiry ? expiryState(expiry) : null;
                return (
                  <tr key={j.id} className="align-top">
                    <td className="px-3 py-3">
                      <Link href={`/jobs/${j.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-50">{j.jobNumber}</Link>
                      <p className="text-xs text-zinc-500">{j.responsible?.name ?? "unassigned"}</p>
                    </td>
                    <td className="px-3 py-3 text-zinc-700 dark:text-zinc-300">
                      {j.client.name}
                      {key === "tax" && d("organization") && <p className="text-xs text-zinc-500">{d("organization")}</p>}
                    </td>
                    {key === "tax" && (
                      <td className="px-3 py-3 text-zinc-500">
                        {d("taxType") ?? "—"}
                        {d("estimatedTax") && <p className="text-xs">est. {formatCurrency(Number(d("estimatedTax")))}</p>}
                        {d("supplier") && <p className="text-xs">{d("supplier")}{d("supplierInvoice") ? ` · inv ${d("supplierInvoice")}` : ""}</p>}
                      </td>
                    )}
                    {key === "immigration" && (
                      <td className="px-3 py-3 text-zinc-500">
                        <span className="text-zinc-700 dark:text-zinc-300">{d("applicant") ?? "—"}</span>
                        <p className="text-xs">{[d("nationality"), d("applicationType")].filter(Boolean).join(" · ")}</p>
                      </td>
                    )}
                    {key === "government" && <td className="px-3 py-3 text-zinc-500">{j.service.name}</td>}
                    <td className="px-3 py-3 text-zinc-500">{latest?.agency.name ?? d("ministry") ?? d("office") ?? d("agency") ?? "—"}</td>
                    <td className="px-3 py-3 text-zinc-500">
                      {latest ? formatDate(latest.submittedAt) : "—"}
                      {latest?.reference && <p className="text-xs">ref {latest.reference}</p>}
                    </td>
                    <td className={`px-3 py-3 ${late ? "font-semibold text-red-600" : "text-zinc-500"}`}>
                      {open ? formatDate(latest.nextFollowUpAt) : "—"}
                      {late && <p className="text-xs">overdue</p>}
                    </td>
                    <td className="px-3 py-3 text-zinc-500">
                      {output ? (output.reference ?? "Received") : "—"}
                      {expiry && (
                        <p className={`text-xs ${exp === "EXPIRED" ? "font-semibold text-red-600" : exp === "EXPIRES_SOON" ? "font-semibold text-amber-600" : ""}`}>
                          {exp === "EXPIRED" ? "expired" : "expires"} {formatDate(expiry)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? "bg-brand-100 text-brand-800 dark:bg-brand-900/40 dark:text-brand-300"}`}>
                        {caseStatusLabel(status, tab.kind)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
