export type DefaultRule = {
  constellationCode: string;
  title: string;
  keywords: string[];
  general: string;
  love: string;
  career: string;
  money: string;
};

export const defaultRules: Record<string, DefaultRule> = {
  Ori: {
    constellationCode: "Ori",
    title: "개척형 별 리딩",
    keywords: ["도전", "직진", "결단"],
    general:
      "오리온 계열 별은 시작을 두려워하지 않는 힘을 뜻합니다. 하고 싶은 일이 생기면 먼저 움직이는 쪽에서 운이 열립니다.",
    love:
      "연애에서는 감정보다 행동이 빠른 편입니다. 상대에게 분명한 표현을 하면 관계가 안정됩니다.",
    career:
      "새 프로젝트, 실험, 런칭 같은 초기 국면에서 강점을 보입니다. 먼저 틀을 잡는 역할이 어울립니다.",
    money:
      "과감한 지출이 생기기 쉬우니 목표를 정한 예산 관리가 중요합니다."
  },
  Lyr: {
    constellationCode: "Lyr",
    title: "조율형 별 리딩",
    keywords: ["균형", "감각", "표현"],
    general:
      "거문고자리 계열 별은 감각과 표현의 흐름을 상징합니다. 말과 글, 디자인, 관계 조율에서 두각을 드러냅니다.",
    love:
      "상대의 마음을 잘 읽지만 너무 맞춰주기 쉬워요. 원하는 기준을 먼저 정해두면 오래 갑니다.",
    career:
      "기획, 편집, 브랜딩, 커뮤니케이션 업무에서 강점이 큽니다.",
    money:
      "수입의 폭은 크지 않아도 소비 만족도가 높은 편입니다. 꾸준한 저축 루틴이 잘 맞습니다."
  },
  Sco: {
    constellationCode: "Sco",
    title: "집중형 별 리딩",
    keywords: ["몰입", "집중", "깊이"],
    general:
      "전갈자리 계열 별은 한 번 정한 목표를 깊게 파고드는 기질을 뜻합니다. 얕고 넓게보다 깊고 좁게 갈 때 성과가 납니다.",
    love:
      "감정의 진폭이 크기 때문에 신뢰가 중요합니다. 불확실한 관계는 빨리 정리하는 편이 좋습니다.",
    career:
      "리서치, 분석, 디버깅, 문제 해결에서 강합니다. 오랜 시간 몰입이 필요한 영역과 잘 맞습니다.",
    money:
      "투자보다 현금 흐름 관리가 먼저입니다. 손실을 줄이는 방식이 오히려 큰 재물운을 만듭니다."
  },
  Vir: {
    constellationCode: "Vir",
    title: "정리형 별 리딩",
    keywords: ["정돈", "관리", "꾸준함"],
    general:
      "처녀자리 계열 별은 구조화와 개선의 힘을 상징합니다. 작은 차이를 다듬는 과정에서 실력이 쌓입니다.",
    love:
      "상대를 세심하게 챙기는 장점이 있지만 지나친 기준은 관계를 지치게 할 수 있습니다.",
    career:
      "운영, QA, 데이터 정리, 백오피스 자동화 같은 분야에서 안정적인 성과를 냅니다.",
    money:
      "소액 분산과 지출 기록 습관이 장기적으로 큰 차이를 만듭니다."
  },
  default: {
    constellationCode: "default",
    title: "탐색형 별 리딩",
    keywords: ["탐색", "변화", "균형"],
    general:
      "이 별은 한 가지 역할에 자신을 고정하기보다 여러 가능성을 탐색하는 흐름을 뜻합니다.",
    love:
      "관계에서는 속도보다 방향이 중요합니다. 나와 맞는 리듬을 찾는 사람이 오래 갑니다.",
    career:
      "다양한 경험을 통해 강점이 선명해지는 타입입니다. 포트폴리오를 쌓는 접근이 좋습니다.",
    money:
      "한 번에 크게 벌기보다 리스크를 줄이며 넓게 시도하는 편이 유리합니다."
  }
};
