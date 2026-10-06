import Link from "next/link";
import type { Report, ReportCell } from "@/lib/finance-reports";
import { formatCurrency } from "@/lib/format";
import { Card, EmptyState } from "@/components/ui";

function show(value: ReportCell, money?: boolean) {
  if (value === null || value === "") return "";
  if (typeof value === "number") return money ? formatCurrency(value) : value.toLocaleString("en-US");
  return value;
}

// Renders a report built by lib/finance-reports (the Excel export uses the
// same data, so the page and the spreadsheet always agree).
export default function ReportView({ report }: { report: Report }) {
  return (
    <div className="flex flex-col gap-6 print:gap-4">
      <div className="hidden print:block">
        <p className="text-lg font-semibold">Portsimex Services Ltd</p>
        <p className="text-xl font-bold">{report.title}</p>
        <p className="text-sm text-zinc-600">{report.subtitle}</p>
      </div>
      {report.alert && (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {report.alert}
        </p>
      )}
      {report.sections.length === 0 && <EmptyState message="Nothing to show." />}
      {report.sections.map((section, si) => (
        <Card key={si} className="overflow-x-auto p-0 print:border-0 print:p-0">
          {section.heading && (
            <h2 className="border-b border-zinc-200 px-4 py-3 font-semibold text-zinc-900 dark:border-zinc-800 dark:text-zinc-50 print:px-0">
              {section.heading}
            </h2>
          )}
          {section.rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-zinc-500">{section.empty ?? "Nothing to show."}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <tr>
                  {section.columns.map((c, ci) => (
                    <th key={ci} className={`px-4 py-2 font-medium print:px-1 ${c.money ? "text-right" : "text-left"}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {section.rows.map((row, ri) => (
                  <tr key={ri} className={row.bold ? "bg-zinc-50 font-semibold dark:bg-zinc-900" : row.muted ? "text-zinc-500" : ""}>
                    {row.cells.map((cell, ci) => {
                      const col = section.columns[ci];
                      const numeric = col?.money || typeof cell === "number";
                      const text = show(cell, col?.money);
                      const negative = typeof cell === "number" && cell < 0;
                      return (
                        <td key={ci} className={`px-4 py-2 print:px-1 ${numeric ? "whitespace-nowrap text-right tabular-nums" : ""} ${negative ? "text-red-600" : ""}`}>
                          {ci === 0 && row.href ? (
                            <Link href={row.href} className="text-brand-600 hover:underline print:text-inherit">
                              {text}
                            </Link>
                          ) : (
                            text
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ))}
      {report.notes && report.notes.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-zinc-500">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
