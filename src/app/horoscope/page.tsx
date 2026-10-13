import type { Metadata } from "next";
import { DailyHoroscopeView } from "@/components/horoscope/DailyHoroscopeView";

export const metadata: Metadata = {
  title: "오늘의 운세 — Astune",
  description: "생년월일로 알아보는 나의 별자리와 매일 새롭게 만나는 오늘의 운세.",
};

export default function HoroscopePage() {
  return <DailyHoroscopeView />;
}
