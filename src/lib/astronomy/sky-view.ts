import type { ReadingPreviewResponse } from "@/types/reading";

type SkyReading = Pick<ReadingPreviewResponse, "input" | "zenithStar" | "astronomyMeta">;

// Stellarium Web's own share links use /skysource/<designation> plus these query keys.
// https://github.com/Stellarium/stellarium-web-engine/blob/master/apps/web-frontend/src/App.vue
// Use the engine's resolved instant: recalculating local time here could change a DST fold.
export function stellariumSkyUrl({ input, zenithStar, astronomyMeta }: SkyReading): string | null {
  const instant = astronomyMeta.calculatedAtUtc;
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(instant)) return null;
  const date = new Date(instant);
  if (!Number.isFinite(date.getTime()) ||
      !Number.isFinite(input.latitude) || Math.abs(input.latitude) > 90 ||
      !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) return null;

  const hasStar = Number.isSafeInteger(zenithStar.hipId) && zenithStar.hipId > 0;
  const url = new URL(hasStar ? `/skysource/HIP${zenithStar.hipId}` : "/", "https://stellarium-web.org");
  url.searchParams.set("date", date.toISOString());
  url.searchParams.set("lat", String(input.latitude));
  url.searchParams.set("lng", String(input.longitude));
  url.searchParams.set("fov", "60");
  // Point near the star even if Stellarium's object lookup is temporarily unavailable.
  if (Number.isFinite(zenithStar.azimuthDeg) && Number.isFinite(zenithStar.altitudeDeg) && Math.abs(zenithStar.altitudeDeg) <= 90) {
    url.searchParams.set("az", String(zenithStar.azimuthDeg));
    url.searchParams.set("alt", String(zenithStar.altitudeDeg));
  }
  return url.toString();
}
