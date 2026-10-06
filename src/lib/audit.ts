import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export type AuditActor = { id: string; name?: string | null };

// Append-only audit trail (a database trigger forbids UPDATE/DELETE on
// audit_logs). Call inside the same transaction as the change it records,
// so the record and the change commit -- or roll back -- together.
export async function audit(
  db: Db,
  actor: AuditActor | null,
  entry: {
    action: string;
    module: string;
    entityType: string;
    entityId?: string | null;
    reference?: string | null;
    jobId?: string | null;
    message: string;
    before?: Prisma.InputJsonValue;
    after?: Prisma.InputJsonValue;
  },
) {
  await db.auditLog.create({
    data: {
      action: entry.action,
      module: entry.module,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      reference: entry.reference ?? null,
      jobId: entry.jobId ?? null,
      message: entry.message,
      before: entry.before,
      after: entry.after,
      actorId: actor?.id ?? null,
      actorName: actor?.name ?? null,
    },
  });
}
