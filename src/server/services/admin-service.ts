import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";

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

export async function createInterpretationRule(input: {
  ruleVersionId: string;
  constellationCode: string;
  title: string;
  keywords: string[];
  generalText: string;
  loveText: string;
  careerText: string;
  moneyText: string;
  adminUserId: string;
}) {
  const version = await prisma.ruleVersion.findUnique({
    where: { id: input.ruleVersionId }
  });

  if (!version) {
    throw new AppError("규칙 버전을 찾을 수 없습니다.", {
      statusCode: 404,
      code: "RULE_VERSION_NOT_FOUND"
    });
  }

  const created = await prisma.interpretationRule.create({
    data: {
      ruleVersionId: input.ruleVersionId,
      constellationCode: input.constellationCode,
      title: input.title,
      keywordsCsv: input.keywords.join(","),
      generalText: input.generalText,
      loveText: input.loveText,
      careerText: input.careerText,
      moneyText: input.moneyText
    }
  });

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: input.adminUserId,
      action: "RULE_CREATED",
      targetType: "interpretation_rule",
      targetId: created.id,
      payloadJson: JSON.stringify({
        ruleVersionId: input.ruleVersionId,
        constellationCode: input.constellationCode
      })
    }
  });

  return {
    ok: true,
    rule: created
  };
}

export async function publishRuleVersion(ruleVersionId: string, adminUserId: string) {
  const version = await prisma.ruleVersion.findUnique({
    where: { id: ruleVersionId }
  });

  if (!version) {
    throw new AppError("규칙 버전을 찾을 수 없습니다.", {
      statusCode: 404,
      code: "RULE_VERSION_NOT_FOUND"
    });
  }

  await prisma.$transaction([
    prisma.ruleVersion.updateMany({
      where: { status: "PUBLISHED" },
      data: { status: "ARCHIVED" }
    }),
    prisma.ruleVersion.update({
      where: { id: ruleVersionId },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date()
      }
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId,
        action: "RULE_VERSION_PUBLISHED",
        targetType: "rule_version",
        targetId: ruleVersionId,
        payloadJson: JSON.stringify({ publishedAt: new Date().toISOString() })
      }
    })
  ]);

  return {
    ok: true,
    ruleVersionId,
    status: "PUBLISHED"
  };
}
