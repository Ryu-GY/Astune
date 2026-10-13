import { z } from "zod";
import { AppError } from "@/lib/errors/app-error";
import type { PreviewReadingInput, AstronomyMeta } from "@/types/reading";
import type { AstroResult } from "@/lib/readings/types";
import { recordCalculation, traceStage } from "@/lib/utils/request-context";
import { astronomyTransport } from "./transport";
import { publicError, errorPolicy } from "@/lib/errors/error-policy";
import { constellationNames } from "./constellations";

const coreResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    selected_star: z.object({ id: z.number().int().positive(), display_name: z.string(), magnitude: z.number().finite() }),
    selected_constellation: z.object({
      code: z.string().nullable(), name_ko: z.string().nullable(), name_en: z.string().nullable()
    }),
    metrics: z.object({ altitude_deg: z.number().finite(), azimuth_deg: z.number().finite(), zenith_distance_deg: z.number().finite() }),
    astronomy_meta: z.object({
      source_label: z.string(), catalog_version: z.string(), engine_name: z.string(),
      candidate_count: z.number().int().nonnegative(), calculated_at_utc: z.string()
    })
  })
});
const coreErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) });

export function requestRepresentativeStar(input: PreviewReadingInput, fetcher: typeof fetch = fetch) {
  return traceStage("astronomy", () => calculate(input, fetcher));
}

async function calculate(input: PreviewReadingInput, fetcher: typeof fetch): Promise<{
  astro: AstroResult; astronomyMeta: AstronomyMeta;
}> {
  const [birthDate, birthTime] = input.birthAtLocal.split("T");
  const origin = process.env.ASTUNE_ASTRO_API_URL || "http://127.0.0.1:8000";
  let response: Response;
  try {
    response = await fetcher(new URL("/api/v1/readings/preview", origin), {
      method: "POST", cache: "no-store", ...astronomyTransport(30000),
      body: JSON.stringify({
        birth_date: birthDate, birth_time_local: birthTime, timezone: input.timezone,
        location_name: input.locationName || "Coordinates", latitude: input.latitude,
        longitude: input.longitude, dst_fold: input.dstFold, max_magnitude: input.maxMagnitude
      })
    });
  } catch {
    throw new AppError("천문 계산 서버에 연결할 수 없습니다. Astune 백엔드 실행 상태를 확인해 주세요.", {
      statusCode: 503, code: "ASTRO_SERVICE_UNAVAILABLE"
    });
  }
  let body: unknown;
  try { body = await response.json(); } catch {
    throw new AppError("천문 계산 서버의 응답 형식이 올바르지 않습니다.", { statusCode: 502, code: "ASTRO_INVALID_RESPONSE" });
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new AppError("천문 계산 서비스를 사용할 수 없습니다.", { statusCode: 503, code: "ASTRO_SERVICE_UNAVAILABLE" });
    }
    const error = coreErrorSchema.safeParse(body);
    const result = publicError(error.success && errorPolicy(error.data.error.code) ? error.data.error.code : "ASTRO_INVALID_RESPONSE",
      error.success ? error.data.error.details : undefined);
    throw new AppError(result.error.message, {
      statusCode: result.status, code: result.error.code, details: result.error.details
    });
  }
  const parsed = coreResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("천문 계산 결과를 읽을 수 없습니다.", { statusCode: 502, code: "ASTRO_INVALID_RESPONSE" });
  }
  const { selected_star: star, selected_constellation: constellation, metrics, astronomy_meta: meta } = parsed.data.data;
  const names = constellationNames(constellation.code);
  const astronomyMeta = {
    sourceLabel: meta.source_label, catalogVersion: meta.catalog_version, engineName: meta.engine_name,
    candidateCount: meta.candidate_count, calculatedAtUtc: meta.calculated_at_utc
  };
  recordCalculation(astronomyMeta);
  return {
    astro: {
      selectedStar: { id: star.id, displayName: star.display_name, magnitude: star.magnitude },
      selectedConstellation: { code: constellation.code || "Unknown", nameKo: constellation.name_ko || names?.nameKo || constellation.name_en || constellation.code || "미상", nameEn: constellation.name_en || names?.nameEn },
      metrics: { altitudeDeg: metrics.altitude_deg, azimuthDeg: metrics.azimuth_deg, zenithDistanceDeg: metrics.zenith_distance_deg },
      astronomyMeta
    }, astronomyMeta
  };
}
