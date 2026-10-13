import { defaultRules } from "@/lib/reading/default-rules";
import type { ReadingBody, ZenithStar } from "@/types/reading";

export function buildReading(star: ZenithStar, displayName?: string): ReadingBody {
  const rule = defaultRules[star.constellationCode] || defaultRules.default;

  const proximityText =
    star.zenithDistanceDeg <= 3
      ? "천정에 매우 가깝게 떠 있던 별이라 상징성이 강하게 작동합니다."
      : star.zenithDistanceDeg <= 8
        ? "천정에 비교적 가깝게 떠 있던 별이라 핵심 성향을 안정적으로 보여줍니다."
        : "대표 별의 상징이 부드럽게 작동하는 타입입니다.";

  const brightnessText =
    star.magnitude <= 1
      ? "밝은 별이 선택되어 존재감과 자기표현의 성향이 강조됩니다."
      : "차분한 밝기의 별이라 내면적인 리듬과 지속성이 강조됩니다.";

  return {
    title: `${displayName || "당신"}의 ${rule.title}`,
    summary: `${rule.general} ${proximityText} ${brightnessText}`,
    keywords: rule.keywords,
    love: rule.love,
    career: rule.career,
    money: rule.money
  };
}
