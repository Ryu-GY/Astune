import type { PrismaClient } from "@prisma/client";
import type { PublishedRuleBundle, RuleLookupInput, RuleRepository } from "./rule-repository";
import { fromPrismaRule } from "./prisma-rule-mapper";

/** Read one published version and only the scopes applicable to the selected star. */
export class PrismaRuleRepository implements RuleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getPublishedRuleBundle(input: RuleLookupInput): Promise<PublishedRuleBundle | null> {
    const version = await this.prisma.ruleVersion.findFirst({
      where: { status: "PUBLISHED" },
      include: { rules: {
        where: { OR: [
          { scopeType: "global" },
          { scopeType: "star", starId: input.starId },
          ...(input.constellationCode ? [{ scopeType: "constellation" as const, constellationCode: input.constellationCode }] : [])
        ] },
        orderBy: [{ priority: "desc" }, { id: "asc" }]
      } },
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }]
    });
    if (!version) return null;
    return {
      version: {
        id: version.id, versionCode: version.name, status: "PUBLISHED",
        publishedAt: version.publishedAt?.toISOString() ?? null, note: version.description
      },
      rules: version.rules.map(fromPrismaRule)
    };
  }
}
