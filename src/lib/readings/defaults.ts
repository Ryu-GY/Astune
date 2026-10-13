import type { ScoreDimension, SectionType } from "./types";

export const SECTION_ORDER: SectionType[] = [
  "overview",
  "personality",
  "love",
  "career",
  "money",
];

export const SECTION_TITLES: Record<SectionType, string> = {
  overview: "총평",
  personality: "성향",
  love: "연애",
  career: "일과 커리어",
  money: "재물",
};

export const DEFAULT_TEMPLATES: Record<SectionType, string> = {
  overview:
    "계산된 별은 {starName}(HIP {starId})입니다. 이 별의 개별 해설은 아직 준비되지 않았습니다. 현재 고유 해설은 기본 계산 대상 93개 별에 제공됩니다.",
  personality:
    "{starName}의 성향 해설이 아직 준비되지 않았습니다.",
  love:
    "{starName}의 연애 해설이 아직 준비되지 않았습니다.",
  career:
    "{starName}의 일과 커리어 해설이 아직 준비되지 않았습니다.",
  money:
    "{starName}의 재물 해설이 아직 준비되지 않았습니다.",
};

export const SCORE_DIMENSIONS: ScoreDimension[] = ["personality", "love", "career", "money"];

export const KEYWORD_EFFECTS: Record<string, Partial<Record<ScoreDimension, number>>> = {
  leadership: { personality: 4, career: 8 },
  "리더십": { personality: 4, career: 8 },
  initiative: { personality: 3, career: 7 },
  "주도성": { personality: 3, career: 7 },
  expressive: { personality: 7, love: 3 },
  "표현력": { personality: 7, love: 3 },
  drive: { personality: 3, career: 7 },
  "추진력": { personality: 3, career: 7 },
  charisma: { personality: 6, career: 4 },
  "카리스마": { personality: 6, career: 4 },
  romantic: { love: 8 },
  "연애운": { love: 8 },
  intuitive: { personality: 4, love: 5 },
  "직관": { personality: 4, love: 5 },
  stable: { money: 7, career: 3 },
  "안정": { money: 7, career: 3 },
  strategic: { career: 6, money: 5 },
  "전략": { career: 6, money: 5 },
  balanced: { love: 3, money: 3 },
  "균형": { love: 3, money: 3 },
  focus: { career: 5, money: 2 },
  "몰입": { career: 5, money: 2 },
};
