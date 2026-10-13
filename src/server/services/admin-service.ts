import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import { interpretationRuleInputSchema } from "@/lib/validation/rule";
import { publishRules } from "./rule-publishing";

export async function listRuleVersions() {
  const versions = await prisma.ruleVersion.findMany({
    include: {
      rules: true
    },
    orderBy: { createdAt: "desc" }
  });

  return {
    ok: true,
    items: versions
  };
}

export async function createRuleVersion(input: {
  name: string;
  description?: string;
  createdById: string;
}) {
  const created = await prisma.ruleVersion.create({
    data: {
      name: input.name,
      description: input.description,
      status: "DRAFT",
      createdById: input.createdById
    }
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.createdById,
      action: "RULE_VERSION_CREATED",
      targetType: "rule_version",
      targetId: created.id,
      payloadJson: JSON.stringify({ name: input.name })
    }
  });

  return {
    ok: true,
    ruleVersion: created
  };
}

export async function createInterpretationRule(input: z.input<typeof interpretationRuleInputSchema> & {
  ruleVersionId: string;
  adminUserId: string;
}, database: PrismaClient = prisma) {
  const rule = interpretationRuleInputSchema.parse(input);
  return database.$transaction(async tx => {
    const version = await tx.ruleVersion.findUnique({
      where: { id: input.ruleVersionId }
    });

    if (!version) {
      throw new AppError("규칙 버전을 찾을 수 없습니다.", {
        statusCode: 404,
        code: "RULE_VERSION_NOT_FOUND"
      });
    }
    if (version.status !== "DRAFT") {
      throw new AppError("초안 버전의 규칙만 수정할 수 있습니다.", {
        statusCode: 409, code: "RULE_VERSION_NOT_DRAFT"
      });
    }

    const created = await tx.interpretationRule.create({
      data: {
        ruleVersionId: input.ruleVersionId,
        scopeType: rule.scopeType,
        constellationCode: rule.constellationCode,
        starId: rule.starId,
        priority: rule.priority,
        title: rule.title,
        keywordsCsv: rule.keywords.join(","),
        generalText: rule.templates.overview,
        personalityText: rule.templates.personality,
        loveText: rule.templates.love,
        careerText: rule.templates.career,
        moneyText: rule.templates.money
      }
    });

    await tx.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: "RULE_CREATED",
        targetType: "interpretation_rule",
        targetId: created.id,
        payloadJson: JSON.stringify({
          ruleVersionId: input.ruleVersionId,
          scopeType: rule.scopeType,
          constellationCode: rule.constellationCode,
          starId: rule.starId,
          priority: rule.priority
        })
      }
    });

    return {
      ok: true,
      rule: created
    };
  });
}

export async function publishRuleVersion(ruleVersionId: string, adminUserId: string) {
  return publishRules(prisma, ruleVersionId, adminUserId);
}
