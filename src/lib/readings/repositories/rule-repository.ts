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
  // Historical constellation rules remain stored for audit/snapshot compatibility,
  // but a constellation must never substitute for the selected individual star.
  return false;
}
