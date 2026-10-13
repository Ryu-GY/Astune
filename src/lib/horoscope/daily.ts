import { DateTime } from "luxon";
import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import type { DailyHoroscope } from "@/types/horoscope";
import { birthDateSchema, publicSign, zodiacForDate, zodiacSigns } from "./zodiac";
import { dailyThemes, luckyColors } from "./daily-content";

export const dailyHoroscopeInputSchema = z.object({ birthDate: birthDateSchema }).strict();

export function createDailyHoroscope(input: unknown, now: Date = new Date()): DailyHoroscope {
  const { birthDate } = dailyHoroscopeInputSchema.parse(input);
  const today = DateTime.fromJSDate(now, { zone: "Asia/Seoul" });
  const date = today.toISODate()!;
  if (birthDate > date) throw new AppError("미래의 생년월일은 입력할 수 없어요.", { code: "BIRTH_DATE_IN_FUTURE", statusCode: 422 });
  const sign = zodiacForDate(birthDate);
  const signIndex = zodiacSigns.indexOf(sign);
  // Calendar days, not elapsed 24-hour periods in a user's local zone.
  const day = Math.floor(DateTime.fromISO(date, { zone: "UTC" }).toMillis() / 86400000);
  const seed = day + signIndex * 7;
  const theme = dailyThemes[seed % dailyThemes.length];
  return {
    date, timeZone: "Asia/Seoul", refreshAt: today.plus({ days: 1 }).startOf("day").toISO()!,
    sign: publicSign(sign), keyword: theme.keyword, title: theme.title,
    summary: `${sign.name}의 상징은 ‘${sign.description}’입니다. ${theme.summary}`,
    sections: [
      { id: "love", title: "연애 · 관계", body: `${theme.love} ${sign.love}` },
      { id: "work", title: "일 · 공부", body: `${theme.work} ${sign.work}` },
      { id: "money", title: "금전 · 소비", body: `${theme.money} ${sign.money}` },
    ],
    action: theme.action,
    lucky: { ...luckyColors[(day + signIndex * 3) % luckyColors.length], number: seed % 9 + 1 },
  };
}
