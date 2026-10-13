import { KEYWORD_EFFECTS, SCORE_DIMENSIONS } from "./defaults";
import type { AstroResult, InterpretationRule, ReadingScore, ScoreDimension } from "./types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
}

function getBaseScore(astro: AstroResult): number {
  const altitudeFactor = normalize(astro.metrics.altitudeDeg, 0, 90);
  const zenithFactor = 1 - normalize(astro.metrics.zenithDistanceDeg, 0, 90);
  const brightnessFactor = 1 - normalize(astro.selectedStar.magnitude, -1.5, 5.5);

  const score = 55 + altitudeFactor * 18 + zenithFactor * 15 + brightnessFactor * 12;
  return Math.round(clamp(score, 0, 100));
}

function normalizeKeyword(keyword: string): string {
  return keyword.trim().toLowerCase();
}

function getKeywordAdjustment(keywords: string[], dimension: ScoreDimension): number {
  return keywords.reduce((sum, keyword) => {
    const effects = KEYWORD_EFFECTS[normalizeKeyword(keyword)] ?? KEYWORD_EFFECTS[keyword.trim()];
    return sum + (effects?.[dimension] ?? 0);
  }, 0);
}

function toGrade(score: number): string {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

export function calculateScores(astro: AstroResult, rules: InterpretationRule[]): ReadingScore[] {
  const baseScore = getBaseScore(astro);
  const keywords = [...new Set(rules.flatMap((rule) => rule.keywords ?? []).filter(Boolean))];

  return SCORE_DIMENSIONS.map((dimension) => {
    const adjustment = getKeywordAdjustment(keywords, dimension);
    const score = Math.round(clamp(baseScore + adjustment, 0, 100));

    return {
      dimension,
      score,
      grade: toGrade(score),
    };
  });
}
