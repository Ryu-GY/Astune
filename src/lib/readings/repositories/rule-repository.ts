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

export function matchesRule(rule: InterpretationRule, input: RuleLookupInput): boolean {
  if (rule.scopeType === "global") return true;
  if (rule.scopeType === "star") return rule.starId === input.starId;
  if (rule.constellationCode) return rule.constellationCode === input.constellationCode;
  return rule.constellationId != null && input.constellationId != null && rule.constellationId === input.constellationId;
}
