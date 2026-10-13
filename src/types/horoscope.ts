export type ZodiacSign = {
  id: string;
  name: string;
  englishName: string;
  symbol: string;
  dateRange: string;
  element: string;
  description: string;
};

export type DailyHoroscope = {
  date: string;
  timeZone: "Asia/Seoul";
  refreshAt: string;
  sign: ZodiacSign;
  keyword: string;
  title: string;
  summary: string;
  sections: { id: "love" | "work" | "money"; title: string; body: string }[];
  action: string;
  lucky: { color: string; colorHex: string; number: number };
};
