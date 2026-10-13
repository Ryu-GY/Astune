export const UNKNOWN_BIRTH_TIME_REFERENCE = "12:00:00";
export const UNKNOWN_BIRTH_TIME_WARNING = "출생 시간을 몰라 정확한 대표 별을 확정할 수 없습니다. 낮 12시를 기준으로 계산한 참고 결과이며, 실제 별과 해석·점수는 달라질 수 있습니다.";

export function referenceTimeWording(text: string) {
  return text.replaceAll("출생 시각", "낮 12시 기준 시각").replaceAll("태어난 순간", "낮 12시 기준");
}

export function birthTimeNotice(birthTimeUnknown?: boolean) {
  return birthTimeUnknown ? {
    code: "BIRTH_TIME_UNKNOWN" as const,
    referenceTimeLocal: UNKNOWN_BIRTH_TIME_REFERENCE,
    message: UNKNOWN_BIRTH_TIME_WARNING,
  } : undefined;
}
