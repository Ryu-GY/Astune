import type { InterpretationRule, RuleVersion } from "../types";
import { STAR_READINGS } from "./star-readings";
import { DEFAULT_TEMPLATES } from "../defaults";

export const DEFAULT_RULE_VERSION: RuleVersion = {
  id: "rv_builtin_2026q4_v3",
  versionCode: "2026Q4_v3",
  status: "PUBLISHED",
  publishedAt: "2026-10-13T00:00:00Z",
  note: "93개 개별 별의 HIP 기반 상세 해설. 5영역 각 3문단, 조언과 별자리 대체 해석 제거.",
};

export const DEFAULT_INTERPRETATION_RULES: InterpretationRule[] = [
  {
    id: "ir_global_unavailable_v3",
    ruleVersionId: DEFAULT_RULE_VERSION.id,
    scopeType: "global",
    priority: 10,
    keywords: [],
    templates: DEFAULT_TEMPLATES,
  },
  ...STAR_READINGS.map(({ hipId, keywords, templates }): InterpretationRule => ({
    id: `ir_star_${hipId}_v3`,
    ruleVersionId: DEFAULT_RULE_VERSION.id,
    scopeType: "star",
    starId: hipId,
    priority: 200,
    keywords,
    templates
  })),
];
