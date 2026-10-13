import type { InterpretationRule, RuleTemplates, RuleVersion } from "../types";
import type { PublishedRuleBundle, RuleLookupInput, RuleRepository } from "./rule-repository";

type RuleVersionRow = {
  id: string;
  versionCode: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishedAt: Date | null;
  note: string | null;
};

type InterpretationRuleRow = {
  id: string;
  ruleVersionId: string;
  scopeType: "global" | "constellation" | "star";
  constellationId: number | null;
  starId: number | null;
  priority: number;
  keywordsJson: unknown;
  overviewTemplate: string | null;
  personalityTemplate: string | null;
  loveTemplate: string | null;
  careerTemplate: string | null;
  moneyTemplate: string | null;
};

type PrismaLike = {
  ruleVersion: {
    findFirst(args: unknown): Promise<RuleVersionRow | null>;
  };
  interpretationRule: {
    findMany(args: unknown): Promise<InterpretationRuleRow[]>;
  };
};

function toVersion(row: RuleVersionRow): RuleVersion {
  return {
    id: row.id,
    versionCode: row.versionCode,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    note: row.note,
  };
}

function toTemplates(row: InterpretationRuleRow): RuleTemplates {
  return {
    overview: row.overviewTemplate ?? undefined,
    personality: row.personalityTemplate ?? undefined,
    love: row.loveTemplate ?? undefined,
    career: row.careerTemplate ?? undefined,
    money: row.moneyTemplate ?? undefined,
  };
}

function toKeywords(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((value): value is string => typeof value === "string") : [];
}

function toRule(row: InterpretationRuleRow): InterpretationRule {
  return {
    id: row.id,
    ruleVersionId: row.ruleVersionId,
    scopeType: row.scopeType,
    constellationId: row.constellationId,
    starId: row.starId,
    priority: row.priority,
    keywords: toKeywords(row.keywordsJson),
    templates: toTemplates(row),
  };
}

export class PrismaRuleRepository implements RuleRepository {
  constructor(private readonly prisma: PrismaLike) {}

  async getPublishedRuleBundle(input: RuleLookupInput): Promise<PublishedRuleBundle | null> {
    const versionRow = await this.prisma.ruleVersion.findFirst({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }],
    });

    if (!versionRow) {
      return null;
    }

    const ruleRows = await this.prisma.interpretationRule.findMany({
      where: {
        ruleVersionId: versionRow.id,
        OR: [
          { scopeType: "global" },
          { scopeType: "star", starId: input.starId },
        ],
      },
      orderBy: [{ priority: "desc" }, { id: "asc" }],
    });

    return {
      version: toVersion(versionRow),
      rules: ruleRows.map(toRule),
    };
  }
}
