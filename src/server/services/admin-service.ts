import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { interpretationRuleInputSchema } from "@/lib/validation/rule";
import { paginationSchema } from "@/lib/validation/reading";
import { publishRules } from "./rule-publishing";
import { auditFailure, lockRuleWrites } from "./admin-audit";

export async function listRuleVersions() {
  return { ok: true, items: await prisma.ruleVersion.findMany({ include: { rules: { orderBy: [{ priority: "desc" }, { id: "asc" }] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }) };
}

export async function createRuleVersion(input: { name: string; description?: string; createdById: string }, database: PrismaClient = prisma) {
  try {
    return await database.$transaction(async tx => {
      const checked = z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).optional() }).parse(input);
      const created = await tx.ruleVersion.create({ data: { ...checked, status: "DRAFT", createdById: input.createdById } });
      await tx.adminAuditLog.create({ data: { adminUserId: input.createdById, action: "RULE_VERSION_CREATED", targetType: "rule_version", targetId: created.id,
        payloadJson: JSON.stringify({ outcome: "SUCCESS", before: null, after: created }) } });
      return { ok: true, ruleVersion: created };
    });
  } catch (error) { await auditFailure(database, input.createdById, "RULE_VERSION_CREATED", "rule_version", undefined, error); throw error; }
}

type RuleInput = z.input<typeof interpretationRuleInputSchema> & { ruleVersionId: string; adminUserId: string; id?: string };
export async function createInterpretationRule(input: RuleInput, database: PrismaClient = prisma) {
  try {
    return await database.$transaction(async tx => {
      await lockRuleWrites(tx);
      const rule = interpretationRuleInputSchema.parse(input);
      const version = await tx.ruleVersion.findUnique({ where: { id: input.ruleVersionId } });
      if (!version) throw new AppError("규칙 버전을 찾을 수 없습니다.", { statusCode: 404, code: "RULE_VERSION_NOT_FOUND" });
      if (version.status !== "DRAFT") throw new AppError("초안 버전의 규칙만 수정할 수 있습니다.", { statusCode: 409, code: "RULE_VERSION_NOT_DRAFT" });
      const before = input.id ? await tx.interpretationRule.findUnique({ where: { id: input.id } }) : null;
      if (before && before.ruleVersionId !== version.id) throw new AppError("다른 버전의 규칙은 변경할 수 없습니다.", { statusCode: 409, code: "RULE_VERSION_MISMATCH" });
      const data = { ruleVersionId: version.id, scopeType: rule.scopeType, constellationCode: rule.constellationCode, starId: rule.starId,
        priority: rule.priority, title: rule.title, keywordsCsv: rule.keywords.join(","),
        generalText: rule.templates.overview, personalityText: rule.templates.personality, loveText: rule.templates.love,
        careerText: rule.templates.career, moneyText: rule.templates.money };
      const after = input.id
        ? await tx.interpretationRule.upsert({ where: { id: input.id }, update: data, create: { id: input.id, ...data } })
        : await tx.interpretationRule.create({ data });
      await tx.adminAuditLog.create({ data: { adminUserId: input.adminUserId, action: before ? "RULE_UPDATED" : "RULE_CREATED", targetType: "interpretation_rule", targetId: after.id,
        payloadJson: JSON.stringify({ outcome: "SUCCESS", before, after }) } });
      return { ok: true, rule: after };
    }, { maxWait: 10000, timeout: 15000 });
  } catch (error) { await auditFailure(database, input.adminUserId, "RULE_UPSERT", "interpretation_rule", input.id, error); throw error; }
}

export async function listAdminAuditLogs(query: unknown) {
  const { page, pageSize } = paginationSchema.parse(query);
  const [items, total] = await prisma.$transaction([
    prisma.adminAuditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
      include: { adminUser: { select: { id: true, name: true, email: true } } } }),
    prisma.adminAuditLog.count(),
  ]);
  return { ok: true, items: items.map(({ payloadJson, ...row }) => ({ ...row, changes: payloadJson ? JSON.parse(payloadJson) : null })), page, pageSize, total };
}
export async function publishRuleVersion(ruleVersionId: string, adminUserId: string) {
  return publishRules(prisma, ruleVersionId, adminUserId);
}
