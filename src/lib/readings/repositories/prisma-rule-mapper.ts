import type { InterpretationRule as RuleRow, Prisma } from "@prisma/client";
import type { InterpretationRule } from "../types";

export function fromPrismaRule(rule: RuleRow): InterpretationRule {
  return {
    id: rule.id,
    ruleVersionId: rule.ruleVersionId,
    scopeType: rule.scopeType,
    constellationCode: rule.constellationCode,
    starId: rule.starId,
    priority: rule.priority,
    keywords: rule.keywordsCsv.split(",").map(value => value.trim()).filter(Boolean),
    templates: {
      overview: rule.generalText,
      personality: rule.personalityText,
      love: rule.loveText,
      career: rule.careerText,
      money: rule.moneyText
    }
  };
}

export function toPrismaRule(rule: InterpretationRule): Prisma.InterpretationRuleUncheckedCreateInput {
  return {
    id: rule.id,
    ruleVersionId: rule.ruleVersionId,
    scopeType: rule.scopeType,
    constellationCode: rule.constellationCode ?? null,
    starId: rule.starId ?? null,
    priority: rule.priority,
    title: rule.id,
    keywordsCsv: (rule.keywords ?? []).join(","),
    generalText: rule.templates.overview ?? "",
    personalityText: rule.templates.personality ?? "",
    loveText: rule.templates.love ?? "",
    careerText: rule.templates.career ?? "",
    moneyText: rule.templates.money ?? ""
  };
}
