import { prisma } from "../lib/prisma.js";

export async function writeAuditLog(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  meta?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: input.meta as object | undefined
    }
  });
}
