import type { PrismaClient } from "@prisma/client";
import type { PublishedRuleBundle, RuleLookupInput, RuleRepository } from "./rule-repository";

/** Adapter for this project's existing Prisma schema (constellation codes, not fixture IDs). */
export class PrismaRuleRepository implements RuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPublishedRuleBundle(input: RuleLookupInput): Promise<PublishedRuleBundle | null> {
    const version = await this.prisma.ruleVersion.findFirst({
      where: { status: "PUBLISHED" }, include: { rules: true },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }]
    });
    if (!version) return null;
    return {
      version: {
        id: version.id, versionCode: version.name, status: "PUBLISHED",
        publishedAt: version.publishedAt?.toISOString() ?? null, note: version.description
      },
      rules: version.rules.filter(rule => rule.constellationCode === "default" || rule.constellationCode === input.constellationCode).map(rule => ({
        id: rule.id, ruleVersionId: version.id,
        scopeType: rule.constellationCode === "default" ? "global" as const : "constellation" as const,
        constellationCode: rule.constellationCode, priority: 100,
        keywords: rule.keywordsCsv.split(",").map(value => value.trim()).filter(Boolean),
        templates: {
          overview: rule.generalText, love: rule.loveText, career: rule.careerText, money: rule.moneyText
        }
      }))
    };
  }
}