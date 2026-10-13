import { RuleBasedInterpretationEngine } from "@/lib/readings/interpreter";
import { DEFAULT_RULE_VERSION, DEFAULT_INTERPRETATION_RULES } from "@/lib/readings/fixtures/default-rules";
import type { ReadingBody, ZenithStar } from "@/types/reading";

export function buildReading(star: ZenithStar, displayName?: string): ReadingBody {
  const result = new RuleBasedInterpretationEngine().interpret({
    version: DEFAULT_RULE_VERSION, rules: DEFAULT_INTERPRETATION_RULES,
    astro: {
      selectedStar: { id: star.hipId, displayName: star.name, magnitude: star.magnitude },
      selectedConstellation: { code: star.constellationCode, nameKo: star.constellationName },
      metrics: { altitudeDeg: star.altitudeDeg, azimuthDeg: star.azimuthDeg, zenithDistanceDeg: star.zenithDistanceDeg },
    },
  });
  const content = (type: string) => result.sections.find(section => section.type === type)!.content;

  return {
    title: `${displayName || "당신"}의 ${star.name} 리딩`,
    summary: result.summary,
    keywords: DEFAULT_INTERPRETATION_RULES.find(rule => rule.starId === star.hipId)?.keywords || [],
    love: content("love"), career: content("career"), money: content("money"),
  };
}
