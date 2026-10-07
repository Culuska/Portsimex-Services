"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/session";
import { hasPermission } from "@/lib/permission-catalog";
import { audit } from "@/lib/audit";
import { nextServiceRequestNumber } from "@/lib/numbering";
import { createJob, syncServiceRequestStatus } from "@/lib/jobs";
import { canMoveRequest, MANAGER_ONLY, type RequestStatus } from "@/lib/request-rules";

type State = { error: string | null };

const optionalMoney = z.union([z.literal(""), z.coerce.number().min(0, "Amounts can't be negative")]);

const requestSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  serviceIds: z.array(z.string().min(1)).min(1, "Choose at least one service"),
  description: z.string().trim().min(1, "Describe what the client needs"),
  requestedByName: z.string().trim(),
  department: z.string().trim(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  requiredBy: z.string(),
  location: z.string().trim(),
  assignedDepartment: z.string().trim(),
  assignedToId: z.string(),
  estimatedRevenue: optionalMoney,
  estimatedCost: optionalMoney,
  submit: z.enum(["DRAFT", "SUBMITTED", "APPROVE"]),
  quoteId: z.string(),
});

export async function createServiceRequestAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requirePermission("requests.manage");
  const parsed = requestSchema.safeParse({
    clientId: formData.get("clientId") ?? "",
    serviceIds: formData.getAll("serviceIds"),
    description: formData.get("description") ?? "",
    requestedByName: formData.get("requestedByName") ?? "",
    department: formData.get("department") ?? "",
    priority: formData.get("priority") ?? "NORMAL",
    requiredBy: formData.get("requiredBy") ?? "",
    location: formData.get("location") ?? "",
    assignedDepartment: formData.get("assignedDepartment") ?? "",
    assignedToId: formData.get("assignedToId") ?? "",
    estimatedRevenue: formData.get("estimatedRevenue") ?? "",
    estimatedCost: formData.get("estimatedCost") ?? "",
    submit: formData.get("submit") ?? "SUBMITTED",
    quoteId: formData.get("quoteId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const approveNow = d.submit === "APPROVE";
  const initialStatus = d.submit === "APPROVE" ? "APPROVED" : d.submit;
  if (approveNow && !hasPermission(user.grant, "requests.approve")) {
    return { error: "Only a manager can approve a request and open its jobs." };
  }

  const services = await prisma.serviceDefinition.findMany({ where: { id: { in: d.serviceIds }, active: true } });
  if (services.length !== new Set(d.serviceIds).size) return { error: "One of the chosen services is no longer offered." };
  if (d.quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: d.quoteId }, include: { serviceRequest: true } });
    if (!quote || quote.clientId !== d.clientId) return { error: "That quotation belongs to a different client." };
    if (quote.serviceRequest) return { error: `Quotation already converted to ${quote.serviceRequest.requestNumber}.` };
  }

  const requiredBy = d.requiredBy ? new Date(d.requiredBy) : null;
  const sr = await prisma.$transaction(async (tx) => {
    const requestNumber = await nextServiceRequestNumber(tx);
    const created = await tx.serviceRequest.create({
      data: {
        requestNumber,
        clientId: d.clientId,
        description: d.description,
        requestedByName: d.requestedByName || null,
        department: d.department || null,
        priority: d.priority,
        requiredBy,
        location: d.location || null,
        assignedDepartment: d.assignedDepartment || null,
        assignedToId: d.assignedToId || null,
        estimatedRevenue: d.estimatedRevenue === "" ? null : d.estimatedRevenue,
        estimatedCost: d.estimatedCost === "" ? null : d.estimatedCost,
        status: initialStatus,
        quoteId: d.quoteId || null,
        createdById: user.id,
        lines: { create: services.map((s) => ({ serviceId: s.id })) },
      },
      include: { lines: true, client: true },
    });
    await audit(tx, user, {
      action: "SERVICE_REQUEST_CREATED",
      module: "Service Requests",
      entityType: "ServiceRequest",
      entityId: created.id,
      reference: requestNumber,
      message: `Created ${requestNumber} for ${created.client.name}: ${services.map((s) => s.name).join(", ")}${approveNow ? " (approved, jobs opened)" : ""}.`,
    });
    if (approveNow) await openJobsForRequest(tx, user, created.id);
    return created;
  });

  revalidatePath("/service-requests");
  redirect(`/service-requests/${sr.id}`);
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function openJobsForRequest(tx: Tx, user: { id: string; name?: string | null }, srId: string, lineId?: string) {
  const sr = await tx.serviceRequest.findUniqueOrThrow({
    where: { id: srId },
    include: { lines: { include: { job: true, service: true } } },
  });
  const lines = sr.lines.filter((l) => !l.job && (!lineId || l.id === lineId));
  const count = sr.lines.length;
  for (const line of lines) {
    await createJob(tx, user, {
      clientId: sr.clientId,
      serviceId: line.serviceId,
      description: [sr.description, line.notes].filter(Boolean).join("\n\n"),
      priority: sr.priority,
      responsibleId: sr.assignedToId,
      requiredBy: sr.requiredBy,
      serviceRequestId: sr.id,
      requestLineId: line.id,
      // Estimates belong to the request as a whole; only carry them onto a
      // job when the request is for a single service.
      estimatedRevenue: count === 1 && sr.estimatedRevenue ? Number(sr.estimatedRevenue) : null,
      estimatedCost: count === 1 && sr.estimatedCost ? Number(sr.estimatedCost) : null,
    });
  }
  await syncServiceRequestStatus(tx, sr.id);
}

export async function moveServiceRequestAction(id: string, to: RequestStatus): Promise<State> {
  const user = await requirePermission("requests.manage", "requests.approve");
  if (MANAGER_ONLY.includes(to) && !hasPermission(user.grant, "requests.approve")) return { error: "Only a manager can do that." };
  const sr = await prisma.serviceRequest.findUniqueOrThrow({ where: { id }, include: { jobs: true } });
  if (!canMoveRequest(sr.status, to)) return { error: `A ${sr.status.toLowerCase()} request can't be moved to ${to.toLowerCase()}.` };
  if (to === "CANCELLED" && sr.jobs.some((j) => j.status !== "CANCELLED")) {
    return { error: "Cancel this request's jobs first -- work has already started." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceRequest.update({ where: { id }, data: { status: to } });
    await audit(tx, user, {
      action: `SERVICE_REQUEST_${to}`,
      module: "Service Requests",
      entityType: "ServiceRequest",
      entityId: id,
      reference: sr.requestNumber,
      message: `${sr.requestNumber} moved from ${sr.status} to ${to}.`,
    });
    if (to === "APPROVED") await openJobsForRequest(tx, user, id);
  });

  revalidatePath(`/service-requests/${id}`);
  revalidatePath("/service-requests");
  revalidatePath("/jobs");
  return { error: null };
}

export async function openJobForLineAction(srId: string, lineId: string): Promise<State> {
  const user = await requirePermission("requests.approve");
  const sr = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: srId } });
  if (!["APPROVED", "IN_PROGRESS", "WAITING", "COMPLETED"].includes(sr.status)) {
    return { error: "Approve the request before opening jobs." };
  }
  await prisma.$transaction((tx) => openJobsForRequest(tx, user, srId, lineId));
  revalidatePath(`/service-requests/${srId}`);
  revalidatePath("/jobs");
  return { error: null };
}

const addLineSchema = z.object({ serviceId: z.string().min(1, "Choose a service"), notes: z.string().trim() });

export async function addRequestLineAction(srId: string, _prev: State, formData: FormData): Promise<State> {
  const user = await requirePermission("requests.manage");
  const parsed = addLineSchema.safeParse({ serviceId: formData.get("serviceId") ?? "", notes: formData.get("notes") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const sr = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: srId } });
  if (["COMPLETED", "CLOSED", "CANCELLED"].includes(sr.status)) return { error: `The request is ${sr.status.toLowerCase()}.` };
  const service = await prisma.serviceDefinition.findUnique({ where: { id: parsed.data.serviceId } });
  if (!service?.active) return { error: "That service is not offered." };
  await prisma.$transaction(async (tx) => {
    await tx.serviceRequestLine.create({ data: { serviceRequestId: srId, serviceId: service.id, notes: parsed.data.notes || null } });
    await audit(tx, user, {
      action: "SERVICE_REQUEST_LINE_ADDED",
      module: "Service Requests",
      entityType: "ServiceRequest",
      entityId: srId,
      reference: sr.requestNumber,
      message: `Added ${service.name} to ${sr.requestNumber}.`,
    });
  });
  revalidatePath(`/service-requests/${srId}`);
  return { error: null };
}
