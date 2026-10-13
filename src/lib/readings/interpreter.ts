import { SECTION_TITLES } from "./defaults";
import { calculateScores } from "./scoring";
import { getMatchedRuleIds, resolveSectionTemplates } from "./rule-selector";
import { buildTemplateContext, renderTemplate } from "./template";
import type { AstroResult, InterpretationRule, PreviewReadingResult, ReadingSection, RuleVersion } from "./types";

function deriveSummary(sections: ReadingSection[]): string {
  const overview = sections.find((section) => section.type === "overview")?.content?.trim();
  if (!overview) {
    return "기본 리딩 요약을 생성하지 못했습니다.";
  }

  if (overview.length <= 90) {
    return overview;
  }

  const firstSentence = overview.split(/(?<=[.!?])\s+/)[0]?.trim();
  if (firstSentence && firstSentence.length <= 90) {
    return firstSentence;
  }

  return `${overview.slice(0, 87).trimEnd()}...`;
}

export interface InterpretParams {
  astro: AstroResult;
  version: RuleVersion;
  rules: InterpretationRule[];
}

export class RuleBasedInterpretationEngine {
  interpret(params: InterpretParams): PreviewReadingResult {
    const context = buildTemplateContext(params.astro, params.rules);
    const resolvedTemplates = resolveSectionTemplates(params.rules);

    const sections: ReadingSection[] = resolvedTemplates.map((resolved, index) => ({
      type: resolved.type,
      title: SECTION_TITLES[resolved.type],
      content: renderTemplate(resolved.template, context),
      sortOrder: index + 1,
      sourceRuleId: resolved.sourceRuleId,
      sourceScope: resolved.sourceScope,
    }));

    return {
      ...params.astro,
      ruleVersionId: params.version.id,
      summary: deriveSummary(sections),
      sections,
      scores: calculateScores(params.astro, params.rules),
      matchedRuleIds: getMatchedRuleIds(params.rules),
    };
  }
}
