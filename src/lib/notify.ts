import { prisma } from "@/lib/prisma";

type NotificationType = "CORRECTION_REQUESTED" | "MINISTRY_ACTION_TAKEN" | "SHIPMENT_CLEARED";

export async function notify(
  userIds: string[],
  type: NotificationType,
  message: string,
  shipmentId?: string,
) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;
  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({ userId, type, message, shipmentId })),
  });
}
