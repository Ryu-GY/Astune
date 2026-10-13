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
    "{starName}을 중심으로 {constellationNameKo}의 흐름이 선명하게 드러납니다. 이번 리딩은 고도 {altitudeDeg}°, 천정 거리 {zenithDistanceDeg}° 기준으로 해석했습니다.",
  personality:
    "기본 성향은 빠른 판단과 또렷한 자기표현에 가깝습니다. 감정 반응이 앞설 수 있지만 중심을 잡으면 큰 추진력으로 연결됩니다.",
  love:
    "관계에서는 솔직함과 선명한 호감 표현이 강점입니다. 다만 템포가 너무 빨라지지 않도록 조절하면 안정감이 높아집니다.",
  career:
    "{focusKeywords} 성향이 일과 커리어에서 강점으로 작동합니다. 방향을 먼저 잡고 움직이는 역할에서 성과가 잘 납니다.",
  money:
    "재물 흐름은 큰 한방보다 관리 습관이 성패를 가릅니다. 기준을 정하고 꾸준히 쌓는 방식이 유리합니다.",
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
