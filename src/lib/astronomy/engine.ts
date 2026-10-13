import { DateTime } from "luxon";
import { AppError } from "@/lib/errors/app-error";
import {
  ASTRO_CATALOG_VERSION,
  ASTRO_ENGINE_NAME,
  ASTRO_SOURCE_LABEL,
  getBrightStarCatalog
} from "@/lib/astronomy/star-catalog";
import type { CatalogStar, ZenithComputationResult, ZenithStarCandidate } from "@/lib/astronomy/types";

function degToRad(value: number) {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number) {
  return (value * 180) / Math.PI;
}

function normalizeDegrees(value: number) {
  let normalized = value % 360;
  if (normalized < 0) normalized += 360;
  return normalized;
}

function toJulianDate(date: Date) {
  return date.getTime() / 86400000 + 2440587.5;
}

function computeLocalSiderealDegrees(dateUtc: Date, longitude: number) {
  const jd = toJulianDate(dateUtc);
  const t = (jd - 2451545.0) / 36525.0;
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t * t -
    (t * t * t) / 38710000;

  return normalizeDegrees(gmst + longitude);
}

function computeHorizontalCoordinates(
  star: CatalogStar,
  latitude: number,
  longitude: number,
  dateUtc: Date
): ZenithStarCandidate {
  const lstDeg = computeLocalSiderealDegrees(dateUtc, longitude);
  const raDeg = star.raHours * 15;
  const hourAngleDeg = normalizeDegrees(lstDeg - raDeg);

  const haRad = degToRad(hourAngleDeg);
  const decRad = degToRad(star.decDegrees);
  const latRad = degToRad(latitude);

  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);

  const altitudeRad = Math.asin(sinAlt);
  const altitudeDeg = radToDeg(altitudeRad);

  const azRad = Math.atan2(
    Math.sin(haRad),
    Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
  );

  const azimuthDeg = normalizeDegrees(radToDeg(azRad) + 180);
  const zenithDistanceDeg = 90 - altitudeDeg;

  return {
    star,
    altitudeDeg,
    azimuthDeg,
    zenithDistanceDeg
  };
}

export function normalizeBirthDateToUtcIso(birthAtLocal: string, timezone: string) {
  const local = DateTime.fromISO(birthAtLocal, { zone: timezone });

  if (!local.isValid) {
    throw new AppError("출생 일시 또는 시간대 형식이 올바르지 않습니다.", {
      statusCode: 400,
      code: "INVALID_BIRTH_DATETIME",
      details: local.invalidExplanation
    });
  }

  return local.toUTC().toISO({ suppressMilliseconds: true });
}

export function computeZenithStar(input: {
  birthAtLocal: string;
  timezone: string;
  latitude: number;
  longitude: number;
  maxMagnitude?: number;
}): ZenithComputationResult & {
  astronomyMeta: {
    sourceLabel: string;
    catalogVersion: string;
    engineName: string;
  };
} {
  const utcIso = normalizeBirthDateToUtcIso(input.birthAtLocal, input.timezone);

  if (!utcIso) {
    throw new AppError("UTC 시각 변환에 실패했습니다.", {
      statusCode: 400,
      code: "UTC_CONVERSION_FAILED"
    });
  }

  const dateUtc = new Date(utcIso);
  const catalog = getBrightStarCatalog(input.maxMagnitude);

  if (catalog.length === 0) {
    throw new AppError("계산 가능한 별 카탈로그가 비어 있습니다.", {
      statusCode: 500,
      code: "EMPTY_STAR_CATALOG"
    });
  }

  const computed = catalog
    .map((star) =>
      computeHorizontalCoordinates(
        star,
        input.latitude,
        input.longitude,
        dateUtc
      )
    )
    .filter((candidate) => candidate.altitudeDeg > 0)
    .sort((a, b) => {
      if (a.zenithDistanceDeg !== b.zenithDistanceDeg) {
        return a.zenithDistanceDeg - b.zenithDistanceDeg;
      }
      return a.star.magnitude - b.star.magnitude;
    });

  if (computed.length === 0) {
    throw new AppError("지평선 위의 후보 별을 찾지 못했습니다.", {
      statusCode: 422,
      code: "NO_VISIBLE_STAR_CANDIDATE"
    });
  }

  return {
    best: computed[0],
    candidateCount: computed.length,
    calculatedAtUtc: utcIso,
    astronomyMeta: {
      sourceLabel: ASTRO_SOURCE_LABEL,
      catalogVersion: ASTRO_CATALOG_VERSION,
      engineName: ASTRO_ENGINE_NAME
    }
  };
}
