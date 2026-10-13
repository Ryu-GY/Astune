import { Prisma, type PrismaClient } from "@prisma/client";
import { AppError } from "@/lib/errors/app-error";
import { interpretationRuleInputSchema } from "@/lib/validation/rule";
import { fromPrismaRule } from "@/lib/readings/repositories/prisma-rule-mapper";
import { auditFailure, lockRuleWrites } from "./admin-audit";

export async function publishInTransaction(tx: Prisma.TransactionClient, ruleVersionId: string, adminUserId: string) {
  await lockRuleWrites(tx);
  const previous = await tx.ruleVersion.findMany({ where: { status: "PUBLISHED", id: { not: ruleVersionId } } });
  await tx.ruleVersion.updateMany({
    where: { status: "PUBLISHED", id: { not: ruleVersionId } },
    data: { status: "ARCHIVED" }
  });
  const version = await tx.ruleVersion.findUnique({ where: { id: ruleVersionId }, include: { rules: true } });
  if (!version) throw new AppError("규칙 버전을 찾을 수 없습니다.", { statusCode: 404, code: "RULE_VERSION_NOT_FOUND" });
  if (version.status === "ARCHIVED") {
    throw new AppError("보관된 버전은 새 초안으로 작성한 뒤 게시해 주세요.", { statusCode: 409, code: "RULE_VERSION_NOT_DRAFT" });
  }
  if (!version.rules.length) {
    throw new AppError("게시하려면 해석 규칙이 하나 이상 필요합니다.", { statusCode: 400, code: "INVALID_RULE_INPUT" });
  }
  for (const row of version.rules) {
    const checked = interpretationRuleInputSchema.safeParse({ ...fromPrismaRule(row), title: row.title });
    if (!checked.success) {
      throw new AppError("게시할 규칙의 범위와 문구를 확인해 주세요.", {
        statusCode: 400, code: "INVALID_RULE_INPUT", details: { ruleId: row.id, issues: checked.error.flatten() }
      });
    }
  }
  if (version.status !== "PUBLISHED") {
    const publishedAt = new Date();
    await tx.ruleVersion.update({ where: { id: ruleVersionId }, data: { status: "PUBLISHED", publishedAt } });
    await tx.adminAuditLog.create({ data: {
      adminUserId, action: "RULE_VERSION_PUBLISHED", targetType: "rule_version", targetId: ruleVersionId,
      payloadJson: JSON.stringify({ outcome: "SUCCESS", before: { version, previouslyPublished: previous },
        after: { version: { ...version, status: "PUBLISHED", publishedAt }, archivedVersionIds: previous.map(item => item.id) } })
    } });
  }
  return { ok: true, ruleVersionId, status: "PUBLISHED" as const };
}

export async function publishRules(prisma: PrismaClient, ruleVersionId: string, adminUserId: string) {
  try {
    return await prisma.$transaction(tx => publishInTransaction(tx, ruleVersionId, adminUserId), {
      maxWait: 10000, timeout: 15000
    });
  } catch (error) {
    await auditFailure(prisma, adminUserId, "RULE_VERSION_PUBLISH", "rule_version", ruleVersionId, error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P1008", "P2002", "P2034"].includes(error.code)) {
      throw new AppError("다른 규칙 게시 작업과 충돌했습니다. 현재 게시 버전을 확인한 뒤 다시 시도해 주세요.", {
        statusCode: 409, code: "RULE_PUBLISH_CONFLICT"
      });
    }
    throw error;
  }
}
