import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import type { ResolveLocationBody } from "@/lib/validation/location";
import { traceStage, upstreamHeaders } from "@/lib/utils/request-context";
import { publicError, errorPolicy } from "@/lib/errors/error-policy";

const responseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    items: z.array(z.object({
      city_name: z.string().nullable(), display_name: z.string().nullable(),
      country_code: z.string().nullable(), latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180), timezone: z.string().min(1),
      source: z.enum(["coordinates", "city_table", "geocoder"]),
      timezone_source: z.string(), attribution: z.string().nullable(),
    })),
    cache_hit: z.boolean(), manual_input_hint: z.string(),
  }),
});
const errorSchema = z.object({error: z.object({code: z.string(), message: z.string(), details: z.unknown().optional()})});

export function requestLocations(input: ResolveLocationBody, fetcher: typeof fetch = fetch) {
  return traceStage("location", () => resolveLocations(input, fetcher));
}

async function resolveLocations(input: ResolveLocationBody, fetcher: typeof fetch) {
  let response: Response;
  try {
    response = await fetcher(new URL("/api/v1/locations/resolve", process.env.ASTUNE_ASTRO_API_URL || "http://127.0.0.1:8000"), {
      method: "POST", headers: upstreamHeaders(), cache: "no-store",
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({query: input.query, country_code: input.countryCode, limit: input.limit,
        latitude: input.latitude, longitude: input.longitude, timezone: input.timezone,
        allow_external: input.allowExternal}),
    });
  } catch {
    throw new AppError("위치 검색 서버에 연결할 수 없습니다. 좌표·시간대를 직접 입력해 주세요.", {statusCode: 503, code: "LOCATION_SERVICE_UNAVAILABLE"});
  }
  let raw: unknown;
  try { raw = await response.json(); } catch {
    throw new AppError("위치 검색 응답을 읽을 수 없습니다.", {statusCode: 502, code: "LOCATION_INVALID_RESPONSE"});
  }
  if (!response.ok) {
    const error = errorSchema.safeParse(raw);
    const result = publicError(error.success && errorPolicy(error.data.error.code) ? error.data.error.code : "LOCATION_INVALID_RESPONSE",
      error.success ? error.data.error.details : undefined);
    throw new AppError(result.error.message, {
      statusCode: result.status, code: result.error.code, details: result.error.details,
    });
  }
  const result = responseSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError("위치 검색 응답 형식이 올바르지 않습니다.", {statusCode: 502, code: "LOCATION_INVALID_RESPONSE"});
  }
  const {data} = result.data;
  return {candidates: data.items.slice(0, input.limit).map(item => ({
    displayName: item.display_name || item.city_name || "Coordinates",
    countryCode: item.country_code, latitude: item.latitude, longitude: item.longitude,
    timezone: item.timezone, source: item.source, timezoneSource: item.timezone_source,
    attribution: item.attribution,
  })), cacheHit: data.cache_hit, manualInputHint: data.manual_input_hint};
}
