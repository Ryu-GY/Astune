import { DateTime } from "luxon";
import { z } from "zod";
import type { ZodiacSign } from "@/types/horoscope";

export const birthDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(value => DateTime.fromISO(value, { zone: "UTC" }).isValid, "유효한 생년월일을 입력해 주세요.");

// Conventional birthday ranges, not a calculation of the Sun's exact ingress time.
// Kept explicit so leap days and both ends of each range can be verified.
export const zodiacSigns = [
  { id: "aquarius", name: "물병자리", englishName: "Aquarius", symbol: "♒", start: 120, dateRange: "1.20 — 2.18", element: "공기", description: "익숙한 것을 새롭게 바라보는 시선",
    love: "서로의 다름을 고치려 하기보다 흥미롭게 들어 보세요.", work: "새로운 방법을 제안할 때는 상대가 따라 할 수 있는 예시를 곁들여 보세요.", money: "새로움에 끌리는 물건일수록 실제 사용할 장면을 먼저 떠올려 보세요." },
  { id: "pisces", name: "물고기자리", englishName: "Pisces", symbol: "♓", start: 219, dateRange: "2.19 — 3.20", element: "물", description: "작은 마음의 움직임을 알아채는 감수성",
    love: "상대의 마음을 추측하는 대신 부드럽게 물어보면 오해가 줄어들어요.", work: "떠오른 생각을 한 줄로 적어 두면 감각을 구체적인 결과로 옮기기 쉬워요.", money: "기분을 달래기 위한 소비라면 다른 휴식 방법도 함께 떠올려 보세요." },
  { id: "aries", name: "양자리", englishName: "Aries", symbol: "♈", start: 321, dateRange: "3.21 — 4.19", element: "불", description: "망설임 너머로 첫발을 내딛는 용기",
    love: "먼저 다가가는 용기에 상대의 속도를 기다리는 여유를 더해 보세요.", work: "시작하는 힘이 좋은 만큼 끝낼 지점도 함께 정해 두면 도움이 돼요.", money: "마음에 드는 것이 보여도 바로 결제하기 전에 목록에 먼저 적어 보세요." },
  { id: "taurus", name: "황소자리", englishName: "Taurus", symbol: "♉", start: 420, dateRange: "4.20 — 5.20", element: "흙", description: "내게 소중한 것을 차분히 가꾸는 힘",
    love: "거창한 약속보다 기억해 둔 취향 하나가 따뜻한 마음을 전해 줄 거예요.", work: "꾸준히 해 오던 방법에 작은 개선 하나만 더해 보세요.", money: "오래 쓸 수 있는지, 이미 비슷한 것을 가지고 있는지 살펴보면 선택이 편해져요." },
  { id: "gemini", name: "쌍둥이자리", englishName: "Gemini", symbol: "♊", start: 521, dateRange: "5.21 — 6.20", element: "공기", description: "다른 생각들을 이어 새로운 길을 찾는 호기심",
    love: "재미있는 이야기만큼 상대가 끝까지 말할 시간을 주는 것도 중요해요.", work: "여러 아이디어 중 오늘 실험할 한 가지만 고르면 집중하기 쉬워요.", money: "여러 선택지를 비교했다면 가장 중요한 기준 하나로 다시 좁혀 보세요." },
  { id: "cancer", name: "게자리", englishName: "Cancer", symbol: "♋", start: 621, dateRange: "6.21 — 7.22", element: "물", description: "편안한 관계와 일상을 돌보는 다정함",
    love: "챙겨 주고 싶은 마음과 내가 쉬고 싶은 마음을 함께 존중해 주세요.", work: "익숙한 작업 환경을 조금 정돈하면 시작하는 부담이 줄어들어요.", money: "누군가를 위한 지출에도 내가 편안하게 감당할 범위를 정해 두세요." },
  { id: "leo", name: "사자자리", englishName: "Leo", symbol: "♌", start: 723, dateRange: "7.23 — 8.22", element: "불", description: "자신의 빛으로 주변까지 밝히는 표현력",
    love: "내 마음을 표현한 뒤에는 상대의 작은 표현도 기쁘게 받아 주세요.", work: "잘한 일을 나누면서 함께 도와준 사람의 기여도 짚어 보세요.", money: "보여 주기 위한 선택인지, 나에게 필요한 선택인지 구분해 보세요." },
  { id: "virgo", name: "처녀자리", englishName: "Virgo", symbol: "♍", start: 823, dateRange: "8.23 — 9.22", element: "흙", description: "작은 부분을 살펴 일상을 단단하게 만드는 정성",
    love: "해결책을 건네기 전에 지금은 들어 주는 것이 필요한지 물어보세요.", work: "완벽하게 다듬기 전에 오늘 꼭 필요한 수준을 정해 보세요.", money: "작은 고정 지출 하나를 살펴보는 일이 마음의 여유로 이어질 수 있어요." },
  { id: "libra", name: "천칭자리", englishName: "Libra", symbol: "♎", start: 923, dateRange: "9.23 — 10.22", element: "공기", description: "서로의 입장 사이에서 균형을 찾는 감각",
    love: "상대를 배려하면서도 내가 바라는 것을 한 가지는 분명히 말해 보세요.", work: "모두의 의견을 들었다면 결정을 내릴 시간도 정해 두세요.", money: "함께 쓰는 비용은 미리 기준을 맞추면 뒤의 불편함을 줄일 수 있어요." },
  { id: "scorpio", name: "전갈자리", englishName: "Scorpio", symbol: "♏", start: 1023, dateRange: "10.23 — 11.21", element: "물", description: "중요한 마음과 일에 깊이 집중하는 진심",
    love: "알아주기를 기다리던 마음을 짧고 솔직한 문장으로 전해 보세요.", work: "몰입하는 중에도 잠깐 멈춰 전체 방향을 살펴보세요.", money: "확신이 강할수록 조건을 한 번 더 읽어 보는 여유가 도움이 돼요." },
  { id: "sagittarius", name: "사수자리", englishName: "Sagittarius", symbol: "♐", start: 1122, dateRange: "11.22 — 12.21", element: "불", description: "더 넓은 가능성을 향해 나아가는 낙관",
    love: "즐거운 제안을 하되 함께할 사람의 일정과 여유도 확인해 보세요.", work: "큰 계획을 오늘 할 수 있는 작은 단계로 나누면 실행이 가까워져요.", money: "경험을 위한 소비도 이동과 준비에 드는 비용까지 함께 생각해 보세요." },
  { id: "capricorn", name: "염소자리", englishName: "Capricorn", symbol: "♑", start: 1222, dateRange: "12.22 — 1.19", element: "흙", description: "시간을 들여 원하는 방향을 만들어 가는 끈기",
    love: "책임감 있는 행동에 따뜻한 말 한마디를 더하면 마음이 더 잘 전해져요.", work: "해야 할 일만큼 이미 해낸 일도 기록해 보세요.", money: "계획을 지키는 가운데 작은 즐거움을 위한 여유도 남겨 두세요." },
] as const;

export function zodiacForDate(birthDate: string): typeof zodiacSigns[number] {
  birthDateSchema.parse(birthDate);
  const monthDay = Number(birthDate.slice(5, 7)) * 100 + Number(birthDate.slice(8));
  let sign: typeof zodiacSigns[number] = zodiacSigns[11];
  for (const candidate of zodiacSigns) if (monthDay >= candidate.start) sign = candidate;
  return sign;
}

export function publicSign(sign: typeof zodiacSigns[number]): ZodiacSign {
  const { id, name, englishName, symbol, dateRange, element, description } = sign;
  return { id, name, englishName, symbol, dateRange, element, description };
}
