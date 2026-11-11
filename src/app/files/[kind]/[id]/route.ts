import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessJob, hasPermission } from "@/lib/permission-catalog";
import { canActOnMinistryStep, canViewVendorShipment } from "@/lib/permissions";
import { isFullAccessRole } from "@/lib/roles";
import { readStoredFile } from "@/lib/blob";

type User = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

async function jobVisible(user: User, jobId: string | null) {
  if (!jobId) return false;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { responsibleId: true, service: { select: { category: true } }, tasks: { select: { assigneeId: true } } },
  });
  if (!job) return false;
  return canAccessJob(user.grant, user.id, {
    category: job.service.category,
    responsibleId: job.responsibleId,
    taskAssigneeIds: job.tasks.map((t) => t.assigneeId).filter((x): x is string => !!x),
  });
}

/** The stored file of a record, if this user may see that record. */
async function resolve(user: User, kind: string, id: string): Promise<{ url: string; name: string } | null> {
  switch (kind) {
    case "job-document": {
      const d = await prisma.jobDocument.findUnique({ where: { id }, select: { fileUrl: true, fileName: true, name: true, jobId: true } });
      if (!d?.fileUrl || !hasPermission(user.grant, "jobs.view") || !(await jobVisible(user, d.jobId))) return null;
      return { url: d.fileUrl, name: d.fileName ?? d.name };
    }
    case "expense-receipt": {
      const e = await prisma.expense.findUnique({ where: { id }, select: { receiptUrl: true, receiptName: true, jobId: true } });
      if (!e?.receiptUrl) return null;
      const allowed = hasPermission(user.grant, "expenses.view") || (hasPermission(user.grant, "jobs.view") && (await jobVisible(user, e.jobId)));
      return allowed ? { url: e.receiptUrl, name: e.receiptName ?? "receipt" } : null;
    }
    case "supplier-bill": {
      const b = await prisma.supplierBill.findUnique({ where: { id }, select: { attachmentUrl: true, attachmentName: true } });
      if (!b?.attachmentUrl || !(hasPermission(user.grant, "bills.manage") || hasPermission(user.grant, "finance.view"))) return null;
      return { url: b.attachmentUrl, name: b.attachmentName ?? "bill" };
    }
    case "clearance": {
      const v = await prisma.clearanceDocumentVersion.findUnique({
        where: { id },
        select: { fileUrl: true, fileName: true, document: { select: { shipment: { select: { clientId: true, approvalSteps: { select: { ministryId: true } } } } } } },
      });
      if (!v) return null;
      const shipment = v.document.shipment;
      const allowed =
        isFullAccessRole(user.role) ||
        hasPermission(user.grant, "shipments.manage") ||
        canViewVendorShipment(user, shipment.clientId) ||
        (user.role === "MINISTRY_OFFICER" && shipment.approvalSteps.some((s) => canActOnMinistryStep(user, s.ministryId)));
      return allowed ? { url: v.fileUrl, name: v.fileName } : null;
    }
    default:
      return null;
  }
}

// Every uploaded file is opened through here: signed in, allowed to see the
// record, then streamed from storage. The storage address is never shown.
export async function GET(_req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Sign in to open this file.", { status: 401 });
  const { kind, id } = await params;
  const target = await resolve(user, kind, id);
  if (!target) return new NextResponse("File not found, or you don't have access to it.", { status: 404 });
  const file = await readStoredFile(target.url);
  if (!file) return new NextResponse("The file could not be read from storage.", { status: 404 });
  const safeName = target.name.replace(/["\\\r\n]/g, "_");
  return new NextResponse(file.stream, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(target.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
