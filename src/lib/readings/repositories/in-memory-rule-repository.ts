import type { InterpretationRule, RuleVersion } from "../types";
import type { PublishedRuleBundle, RuleLookupInput, RuleRepository } from "./rule-repository";
import { matchesRule } from "./rule-repository";

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
