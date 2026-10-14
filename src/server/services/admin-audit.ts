import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { getDatabaseConfig } from "@/lib/config/env";

export async function lockRuleWrites(tx: Prisma.TransactionClient) {
  if (getDatabaseConfig().provider === "postgresql") {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(414535, 1)`;
  } else {
    // Even a zero-row UPDATE obtains SQLite's write reservation before reads.
    await tx.ruleVersion.updateMany({ where: { id: "__astune_write_lock__" }, data: { updatedAt: new Date() } });
  }
}

export async function auditFailure(db: PrismaClient, actor: string, action: string, targetType: string, targetId: string | undefined, error: unknown) {
  try {
    await db.adminAuditLog.create({ data: {
      adminUserId: actor, action: `${action}_FAILED`, targetType, targetId,
      payloadJson: JSON.stringify({ outcome: "FAILED", code: error instanceof AppError ? error.code : "OPERATION_FAILED" }),
    } });
  } catch { console.error("Admin failure audit could not be persisted", { action, targetType }); }
}
