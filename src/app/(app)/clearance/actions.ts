"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requireMinistryOfficer, requireLogisticsStaff } from "@/lib/session";
import { canViewVendorShipment } from "@/lib/permissions";
import { isFullAccessRole } from "@/lib/roles";
import { uploadClearanceFile } from "@/lib/blob";
import { notify } from "@/lib/notify";
import {
  applyAction,
  applyVendorResubmit,
  assertCanAct,
  InvalidTransitionError,
  type ApprovalActionType,
} from "@/lib/clearance-state-machine";

// -----------------------------------------------------------------------
// Start clearance: builds the ApprovalStep chain for a shipment from its
// type's configured MinistryChainStep sequence.
// -----------------------------------------------------------------------
export async function startClearanceAction(
  shipmentId: string,
  _prevState: { error: string | null },
  _formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireUser();

  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });

  if (!canViewVendorShipment({ role: user.role, vendorClientId: user.vendorClientId }, shipment.clientId)) {
    return { error: "Not authorized for this shipment" };
  }

  if (shipment.clearanceStatus !== "NOT_STARTED") {
    return { error: "Clearance has already been started for this shipment" };
  }

  const chain = await prisma.ministryChainStep.findMany({
    where: { shipmentType: shipment.type },
    orderBy: { position: "asc" },
    include: { ministry: true },
  });

  if (chain.length === 0) {
    return { error: `No approval chain configured for shipment type ${shipment.type}` };
  }

  await prisma.$transaction([
    ...chain.map((step, index) =>
      prisma.approvalStep.create({
        data: {
          shipmentId,
          ministryId: step.ministryId,
          position: step.position,
          status: index === 0 ? "IN_REVIEW" : "PENDING",
          startedAt: index === 0 ? new Date() : null,
        },
      }),
    ),
    prisma.shipment.update({
      where: { id: shipmentId },
      data: { clearanceStatus: "IN_REVIEW" },
    }),
  ]);

  const firstMinistryUsers = await prisma.user.findMany({
    where: { ministryId: chain[0].ministryId },
    select: { id: true },
  });
  await notify(
    firstMinistryUsers.map((u) => u.id),
    "MINISTRY_ACTION_TAKEN",
    `New shipment ${shipment.reference} is awaiting your review.`,
    shipmentId,
  );

  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/ministry");
  revalidatePath("/my-shipments");
  return { error: null };
}

// -----------------------------------------------------------------------
// Vendor uploads a document (initial submission, or a corrected version).
// -----------------------------------------------------------------------
const uploadSchema = z.object({
  shipmentId: z.string().min(1),
  documentType: z.string().min(1, "Document type is required"),
});

export async function uploadClearanceDocumentAction(
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireUser();

  const parsed = uploadSchema.safeParse({
    shipmentId: formData.get("shipmentId"),
    documentType: formData.get("documentType"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload" };
  }

  const shipment = await prisma.shipment.findUniqueOrThrow({
    where: { id: parsed.data.shipmentId },
  });
  if (!canViewVendorShipment({ role: user.role, vendorClientId: user.vendorClientId }, shipment.clientId)) {
    return { error: "Not authorized for this shipment" };
  }

  const { url, fileName } = await uploadClearanceFile(file, parsed.data.shipmentId);

  const existingDoc = await prisma.clearanceDocument.findFirst({
    where: { shipmentId: parsed.data.shipmentId, documentType: parsed.data.documentType },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });

  if (existingDoc) {
    const nextVersion = (existingDoc.versions[0]?.version ?? 0) + 1;
    await prisma.clearanceDocumentVersion.create({
      data: {
        documentId: existingDoc.id,
        version: nextVersion,
        fileUrl: url,
        fileName,
        uploadedById: user.id,
      },
    });
  } else {
    await prisma.clearanceDocument.create({
      data: {
        shipmentId: parsed.data.shipmentId,
        documentType: parsed.data.documentType,
        uploadedById: user.id,
        versions: {
          create: { version: 1, fileUrl: url, fileName, uploadedById: user.id },
        },
      },
    });
  }

  revalidatePath(`/shipments/${parsed.data.shipmentId}`);
  revalidatePath("/my-shipments");
  return { error: null };
}

// -----------------------------------------------------------------------
// Vendor resubmits after a correction was requested: puts the SAME step
// back in review at the SAME ministry. Does not restart the chain.
// -----------------------------------------------------------------------
export async function resubmitForReviewAction(
  shipmentId: string,
  _prevState: { error: string | null },
  _formData: FormData,
): Promise<{ error: string | null }> {
  const user = await requireUser();

  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  if (!canViewVendorShipment({ role: user.role, vendorClientId: user.vendorClientId }, shipment.clientId)) {
    return { error: "Not authorized for this shipment" };
  }

  const step = await prisma.approvalStep.findFirst({
    where: { shipmentId, status: "CORRECTION_REQUESTED" },
  });
  if (!step) {
    return { error: "This shipment has no correction pending." };
  }

  let result;
  try {
    result = applyVendorResubmit(step);
  } catch (e) {
    if (e instanceof InvalidTransitionError) return { error: e.message };
    throw e;
  }

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: step.id },
      data: { status: result.stepStatus, startedAt: new Date() },
    }),
    prisma.shipment.update({
      where: { id: shipmentId },
      data: { clearanceStatus: result.shipmentClearanceStatus },
    }),
  ]);

  const ministryUsers = await prisma.user.findMany({
    where: { ministryId: step.ministryId },
    select: { id: true },
  });
  await notify(
    ministryUsers.map((u) => u.id),
    "MINISTRY_ACTION_TAKEN",
    `${shipment.reference} was resubmitted with corrected documents.`,
    shipmentId,
  );

  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/ministry");
  revalidatePath("/my-shipments");
  return { error: null };
}

// -----------------------------------------------------------------------
// Ministry officer acts on the step currently in review at their ministry.
// -----------------------------------------------------------------------
const actionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT", "REQUEST_CORRECTION"]),
  note: z.string().min(1, "A note is required for every action"),
  documentVersionId: z.string().optional().or(z.literal("")),
});

export async function takeApprovalActionAction(
  stepId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const parsed = actionSchema.safeParse({
    action: formData.get("action"),
    note: formData.get("note"),
    documentVersionId: formData.get("documentVersionId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const step = await prisma.approvalStep.findUniqueOrThrow({
    where: { id: stepId },
    include: { shipment: true },
  });

  const officer = await requireMinistryOfficer(step.ministryId);

  try {
    assertCanAct(step, {
      ministryId: officer.ministryId,
      isAdmin: isFullAccessRole(officer.role),
    });
  } catch (e) {
    if (e instanceof InvalidTransitionError) return { error: e.message };
    throw e;
  }

  const nextStep = await prisma.approvalStep.findFirst({
    where: { shipmentId: step.shipmentId, position: step.position + 1 },
  });

  const action = parsed.data.action as ApprovalActionType;
  const result = applyAction(action, nextStep === null);

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: step.id },
      data: { status: result.stepStatus, decidedAt: new Date() },
    }),
    prisma.approvalAction.create({
      data: {
        stepId: step.id,
        actorId: officer.id,
        action,
        note: parsed.data.note,
        documentVersionId: parsed.data.documentVersionId || null,
      },
    }),
    ...(result.advanceNextStep && nextStep
      ? [
          prisma.approvalStep.update({
            where: { id: nextStep.id },
            data: { status: "IN_REVIEW" as const, startedAt: new Date() },
          }),
        ]
      : []),
    prisma.shipment.update({
      where: { id: step.shipmentId },
      data: { clearanceStatus: result.shipmentClearanceStatus },
    }),
  ]);

  const vendorUsers = await prisma.user.findMany({
    where: { vendorClientId: step.shipment.clientId },
    select: { id: true },
  });
  const notifyUserIds = vendorUsers.map((u) => u.id);

  if (action === "REQUEST_CORRECTION") {
    await notify(
      notifyUserIds,
      "CORRECTION_REQUESTED",
      `${step.shipment.reference}: correction requested -- ${parsed.data.note}`,
      step.shipmentId,
    );
  } else if (result.shipmentClearanceStatus === "CLEARED_FOR_DELIVERY") {
    const logisticsUsers = await prisma.user.findMany({
      where: { role: "LOGISTICS_STAFF" },
      select: { id: true },
    });
    await notify(
      [...notifyUserIds, ...logisticsUsers.map((u) => u.id)],
      "SHIPMENT_CLEARED",
      `${step.shipment.reference} is cleared for delivery.`,
      step.shipmentId,
    );
  } else {
    await notify(
      notifyUserIds,
      "MINISTRY_ACTION_TAKEN",
      `${step.shipment.reference}: ${action.toLowerCase().replace("_", " ")}.`,
      step.shipmentId,
    );
    if (result.advanceNextStep && nextStep) {
      const nextMinistryUsers = await prisma.user.findMany({
        where: { ministryId: nextStep.ministryId },
        select: { id: true },
      });
      await notify(
        nextMinistryUsers.map((u) => u.id),
        "MINISTRY_ACTION_TAKEN",
        `${step.shipment.reference} is now awaiting your review.`,
        step.shipmentId,
      );
    }
  }

  revalidatePath(`/shipments/${step.shipmentId}`);
  revalidatePath("/ministry");
  revalidatePath("/my-shipments");
  return { error: null };
}

// -----------------------------------------------------------------------
// Delivery record: terminal step for this module.
// -----------------------------------------------------------------------
const deliverySchema = z.object({
  deliveryMode: z.enum(["AIRPORT", "SEAPORT"]),
  destinationDetail: z.string().min(1, "Destination detail is required"),
});

export async function createDeliveryRecordAction(
  shipmentId: string,
  _prevState: { error: string | null },
  formData: FormData,
): Promise<{ error: string | null }> {
  const staff = await requireLogisticsStaff();

  const parsed = deliverySchema.safeParse({
    deliveryMode: formData.get("deliveryMode"),
    destinationDetail: formData.get("destinationDetail"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const shipment = await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
  if (shipment.clearanceStatus !== "CLEARED_FOR_DELIVERY") {
    return { error: "Shipment is not cleared for delivery yet" };
  }

  const existing = await prisma.deliveryRecord.findUnique({ where: { shipmentId } });
  if (existing) {
    return { error: "A delivery record already exists for this shipment" };
  }

  await prisma.deliveryRecord.create({
    data: {
      shipmentId,
      deliveryMode: parsed.data.deliveryMode,
      destinationDetail: parsed.data.destinationDetail,
      createdById: staff.id,
    },
  });

  revalidatePath(`/shipments/${shipmentId}`);
  revalidatePath("/deliveries");
  return { error: null };
}
