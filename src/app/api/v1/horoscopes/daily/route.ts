import { createDailyHoroscope } from "@/lib/horoscope/daily";
import { readJsonBody } from "@/lib/utils/request-body";
import { handleApiRequest, ok } from "@/lib/utils/http";

export async function POST(request: Request) {
  return handleApiRequest(request, async () => ok({ horoscope: createDailyHoroscope(await readJsonBody(request)) }));
}
