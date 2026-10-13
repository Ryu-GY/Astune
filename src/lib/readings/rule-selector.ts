import { DEFAULT_TEMPLATES, SECTION_ORDER } from "./defaults";
import type { InterpretationRule, ReadingSection, RuleTemplates, ScopeType, SectionType } from "./types";

function compareRulePriority(left: InterpretationRule, right: InterpretationRule): number {
  if (left.priority !== right.priority) {
    return right.priority - left.priority;
  }

  return left.id.localeCompare(right.id);
}

function sortRules(rules: InterpretationRule[]): InterpretationRule[] {
  return [...rules].sort(compareRulePriority);
}

function groupRulesByScope(rules: InterpretationRule[]): Record<ScopeType, InterpretationRule[]> {
  return {
    star: sortRules(rules.filter((rule) => rule.scopeType === "star")),
    constellation: sortRules(rules.filter((rule) => rule.scopeType === "constellation")),
    global: sortRules(rules.filter((rule) => rule.scopeType === "global")),
  };
}

function getTemplate(rule: InterpretationRule, sectionType: SectionType): string | undefined {
  return rule.templates[sectionType];
}

function resolveTemplateForSection(
  grouped: Record<ScopeType, InterpretationRule[]>,
  sectionType: SectionType,
): { template: string; sourceRuleId: string | null; sourceScope: ScopeType | "default" } {
  const scopeOrder: ScopeType[] = ["star", "constellation", "global"];

  for (const scope of scopeOrder) {
    const matched = grouped[scope].find((rule) => {
      const template = getTemplate(rule, sectionType);
      return typeof template === "string" && template.trim().length > 0;
    });

    if (matched) {
      return {
        template: matched.templates[sectionType] as string,
        sourceRuleId: matched.id,
        sourceScope: scope,
      };
    }
  }

  return {
    template: DEFAULT_TEMPLATES[sectionType],
    sourceRuleId: null,
    sourceScope: "default",
  };
}

export interface ResolvedSectionTemplate {
  type: SectionType;
  template: string;
  sourceRuleId: string | null;
  sourceScope: ScopeType | "default";
}

export function resolveSectionTemplates(rules: InterpretationRule[]): ResolvedSectionTemplate[] {
  const grouped = groupRulesByScope(rules);

  return SECTION_ORDER.map((sectionType) => {
    const resolved = resolveTemplateForSection(grouped, sectionType);
    return {
      type: sectionType,
      template: resolved.template,
      sourceRuleId: resolved.sourceRuleId,
      sourceScope: resolved.sourceScope,
    };
  });
}

export function getMatchedRuleIds(rules: InterpretationRule[]): string[] {
  return sortRules(rules).map((rule) => rule.id);
}

export function mergeTemplates(templates: RuleTemplates[]): RuleTemplates {
  return templates.reduce<RuleTemplates>((acc, current) => ({ ...acc, ...current }), {});
}
