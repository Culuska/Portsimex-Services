import { buildReport, defaultPeriod, isReportKey } from "@/lib/finance-reports";
import { endOfDay, parseDay } from "@/lib/finance";
import { canSeeReport } from "@/lib/finance-access";
import { getCurrentUser } from "@/lib/session";
import { buildXlsx, type Sheet } from "@/lib/xlsx";

// Excel download of any finance report -- the same data the report page shows.
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report: key } = await params;
  if (!isReportKey(key)) return new Response("Unknown report", { status: 404 });
  const me = await getCurrentUser();
  if (!me) return new Response("Sign in first", { status: 401 });
  if (!canSeeReport(me.grant, key)) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const q = (k: string) => url.searchParams.get(k) ?? undefined;
  const def = defaultPeriod();
  const report = await buildReport(key, {
    from: parseDay(q("from"), def.from),
    to: endOfDay(parseDay(q("to"), def.to)),
    clientId: q("client"),
  });

  const title = ["Portsimex Services Ltd", report.title, report.subtitle];
  const sheets: Sheet[] = report.sections.map((s, i) => ({
    name: s.heading ?? (report.sections.length > 1 ? `Part ${i + 1}` : report.title),
    title: i === 0 ? title : [report.title, s.heading ?? ""],
    columns: s.columns.map((c) => ({ label: c.label, money: c.money })),
    rows: s.rows.map((r) => ({ cells: r.cells, bold: r.bold })),
  }));
  if (report.notes?.length) {
    sheets.push({ name: "Notes", title: [report.title], columns: [{ label: "Notes", width: 110 }], rows: report.notes.map((n) => ({ cells: [n] })) });
  }
  if (sheets.length === 0) sheets.push({ name: report.title, title, columns: [{ label: "Nothing to show" }], rows: [] });

  const bytes = buildXlsx(sheets);
  const filename = `${report.title.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "_")}_${url.searchParams.get("to") ?? "today"}.xlsx`;
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
