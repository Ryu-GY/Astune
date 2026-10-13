import type { InterpretationRule, RuleVersion } from "../types";

export const DEFAULT_RULE_VERSION: RuleVersion = {
  id: "rv_default_published",
  versionCode: "2026Q2_v1",
  status: "PUBLISHED",
  publishedAt: "2026-04-13T09:15:00Z",
  note: "기본 규칙 세트",
};

export const DEFAULT_INTERPRETATION_RULES: InterpretationRule[] = [
  {
    id: "ir_global_default",
    ruleVersionId: DEFAULT_RULE_VERSION.id,
    scopeType: "global",
    priority: 10,
    keywords: ["균형", "직관"],
    templates: {
      overview:
        "{starName}을 중심으로 {constellationNameKo}의 결이 드러나는 흐름입니다. 출생 시각의 하늘에서 고도 {altitudeDeg}°를 기준으로 해석했습니다.",
      personality:
        "기본 성향은 직관과 실행력이 함께 움직이는 타입입니다. 결정을 오래 끌기보다 빠르게 정리하고 다음 행동으로 넘어가는 편입니다.",
      love:
        "관계에서는 감정을 숨기기보다 분명하게 표현하는 편이 유리합니다. 솔직함은 장점이지만 속도 조절이 관계의 완성도를 높입니다.",
      career:
        "일에서는 먼저 방향을 정하고 밀어붙이는 힘이 좋습니다. 실행 전 기준만 정리해 두면 성과가 훨씬 안정적으로 쌓입니다.",
      money:
        "재물은 감각보다 원칙이 강할수록 좋아집니다. 소비 기준과 축적 기준을 나눠 관리하면 손실을 줄이기 쉽습니다.",
    },
  },
  {
    id: "ir_constellation_ori",
    ruleVersionId: DEFAULT_RULE_VERSION.id,
    scopeType: "constellation",
    constellationCode: "Ori",
    priority: 100,
    keywords: ["표현력", "주도성"],
    templates: {
      overview: "{constellationNameKo} 흐름은 자기표현과 존재감이 강한 편입니다. 보이는 자리에서 강점을 드러낼수록 운이 붙습니다.",
      career: "커리어에서는 리더 역할, 발표, 조율, 기획 주도에서 강점이 큽니다. 남보다 먼저 판을 짜는 포지션이 잘 맞습니다.",
    },
  },
  {
    id: "ir_star_betelgeuse",
    ruleVersionId: DEFAULT_RULE_VERSION.id,
    scopeType: "star",
    starId: 27989,
    priority: 200,
    keywords: ["추진력", "카리스마", "몰입"],
    templates: {
      overview: "{starName}의 흐름은 강한 추진력과 표현력이 동시에 드러나는 타입입니다. 결정 후 속도를 붙이는 구간에서 특히 힘이 좋습니다.",
      personality: "성향은 카리스마와 몰입력이 강한 편입니다. 한번 목표를 잡으면 집중도가 높아지고 존재감도 자연스럽게 커집니다.",
      love: "연애에서는 감정의 확신이 생기면 빠르게 움직이는 타입입니다. 매력을 숨기기보다 선명하게 보여줄수록 관계가 또렷해집니다.",
    },
  },
];
