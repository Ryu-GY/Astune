import type { InterpretationRule, RuleVersion } from "../types";

export interface RuleLookupInput {
  starId: number;
  constellationId?: number | null;
  constellationCode?: string | null;
}

export interface PublishedRuleBundle {
  version: RuleVersion;
  rules: InterpretationRule[];
}

export interface RuleRepository {
  getPublishedRuleBundle(input: RuleLookupInput): Promise<PublishedRuleBundle | null>;
}
