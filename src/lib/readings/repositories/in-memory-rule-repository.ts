import type { InterpretationRule, RuleVersion } from "../types";
import type { PublishedRuleBundle, RuleLookupInput, RuleRepository } from "./rule-repository";

function matchesRule(rule: InterpretationRule, input: RuleLookupInput): boolean {
  if (rule.scopeType === "global") return true;
  if (rule.scopeType === "star") return rule.starId === input.starId;
  if (rule.scopeType === "constellation") {
    if (rule.constellationCode) return rule.constellationCode === input.constellationCode;
    return rule.constellationId != null && input.constellationId != null && rule.constellationId === input.constellationId;
  }
  return false;
}

export class InMemoryRuleRepository implements RuleRepository {
  constructor(
    private readonly version: RuleVersion,
    private readonly rules: InterpretationRule[],
  ) {}

  async getPublishedRuleBundle(input: RuleLookupInput): Promise<PublishedRuleBundle | null> {
    if (this.version.status !== "PUBLISHED") {
      return null;
    }

    return {
      version: this.version,
      rules: this.rules.filter((rule) => rule.ruleVersionId === this.version.id && matchesRule(rule, input)),
    };
  }
}
