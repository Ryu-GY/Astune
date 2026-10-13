import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { constellationNames } from "../src/lib/astronomy/constellations";
import { requestRepresentativeStar } from "../src/lib/astronomy/core-client";
import { stellariumSkyUrl } from "../src/lib/astronomy/sky-view";
import type { ReadingPreviewResponse } from "../src/types/reading";

const reading: Pick<ReadingPreviewResponse, "input" | "zenithStar" | "astronomyMeta"> = {
  input: { name: "지도에 보내지 않을 이름", birthAtLocal: "1995-05-05T15:00:00", timezone: "Asia/Seoul", latitude: 37.5665, longitude: 126.978, locationName: "서울" },
  zenithStar: { hipId: 24608, name: "Capella", constellationCode: "Aur", constellationName: "Auriga", magnitude: 0.08, altitudeDeg: 81.564, azimuthDeg: 356.9, zenithDistanceDeg: 8.436 },
  astronomyMeta: { calculatedAtUtc: "1995-05-05T06:00:00+00:00", candidateCount: 31, engineName: "Skyfield", catalogVersion: "test", sourceLabel: "fixture" },
};

test("Stellarium opens the selected HIP star at the computed instant and location without sending the name", () => {
  const url = new URL(stellariumSkyUrl(reading)!);
  assert.equal(url.origin, "https://stellarium-web.org");
  assert.equal(url.pathname, "/skysource/HIP24608");
  assert.equal(url.searchParams.get("date"), "1995-05-05T06:00:00.000Z");
  assert.equal(url.searchParams.get("lat"), "37.5665");
  assert.equal(url.searchParams.get("lng"), "126.978");
  assert.equal(url.searchParams.get("alt"), "81.564");
  assert.equal(url.searchParams.get("az"), "356.9");
  assert(!decodeURIComponent(url.toString()).includes(reading.input.name!));
  assert(!decodeURIComponent(url.toString()).includes("서울"));
});

test("sky links preserve the astronomy engine's DST fold and unknown-time reference noon", () => {
  const input = { ...reading.input, birthAtLocal: "2024-11-03T01:30:00", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006, dstFold: 1 as const };
  const folded = stellariumSkyUrl({ ...reading, input, astronomyMeta: { ...reading.astronomyMeta, calculatedAtUtc: "2024-11-03T06:30:00Z" } });
  assert.equal(new URL(folded!).searchParams.get("date"), "2024-11-03T06:30:00.000Z");
  const noon = stellariumSkyUrl({ ...reading, input: { ...reading.input, birthTimeUnknown: true, birthAtLocal: "1995-05-05T12:00:00" }, astronomyMeta: { ...reading.astronomyMeta, calculatedAtUtc: "1995-05-05T03:00:00Z" } });
  assert.equal(new URL(noon!).searchParams.get("date"), "1995-05-05T03:00:00.000Z");
});

test("sky links accept the equator and Greenwich, but do not silently fall back to today's sky for invalid data", () => {
  const zero = stellariumSkyUrl({ ...reading, input: { ...reading.input, latitude: 0, longitude: 0 } });
  assert.equal(new URL(zero!).searchParams.get("lat"), "0");
  assert.equal(new URL(zero!).searchParams.get("lng"), "0");
  for (const calculatedAtUtc of ["", "invalid", "1995-05-05T06:00:00", "invalidZ"]) {
    assert.equal(stellariumSkyUrl({ ...reading, astronomyMeta: { ...reading.astronomyMeta, calculatedAtUtc } }), null);
  }
  for (const latitude of [NaN, Infinity, 91, -91]) {
    assert.equal(stellariumSkyUrl({ ...reading, input: { ...reading.input, latitude } }), null);
  }
});

test("every constellation used by the star catalogue has a Korean name, including old saved English results", () => {
  const catalogue = JSON.parse(readFileSync(new URL("../data/astro/bright-stars.json", import.meta.url), "utf8")) as { constellationCode: string }[];
  const codes = new Set(catalogue.map(star => star.constellationCode));
  assert.equal(codes.size, 88);
  for (const code of codes) {
    assert.match(constellationNames(code)?.nameKo || "", /자리$/, code);
    assert(constellationNames(code)?.nameEn, code);
  }
  assert.equal(constellationNames(reading.zenithStar.constellationCode)?.nameKo, "마차부자리");
  assert.equal(constellationNames("CMa")?.nameKo, "큰개자리");
  assert.equal(constellationNames("Unknown"), undefined);
  assert.equal(constellationNames("constructor"), undefined);
});

test("English-only astronomy responses receive the constellation's Korean name before interpretation", async () => {
  const fetcher: typeof fetch = async () => Response.json({ success: true, data: {
    selected_star: { id: 24608, display_name: "Capella", magnitude: 0.08 },
    selected_constellation: { code: "Aur", name_ko: null, name_en: "Auriga" },
    metrics: { altitude_deg: 81.564, azimuth_deg: 356.9, zenith_distance_deg: 8.436 },
    astronomy_meta: { source_label: "fixture", catalog_version: "test", engine_name: "Skyfield", candidate_count: 31, calculated_at_utc: "1995-05-05T06:00:00Z" },
  } });
  const { astro } = await requestRepresentativeStar(reading.input, fetcher);
  assert.deepEqual(astro.selectedConstellation, { code: "Aur", nameKo: "마차부자리", nameEn: "Auriga" });
});

test("all 88 catalogue constellations ship their own distinct WebP illustration", () => {
  const catalogue = JSON.parse(readFileSync(new URL("../data/astro/bright-stars.json", import.meta.url), "utf8")) as { constellationCode: string }[];
  const hashes = new Set<string>();
  for (const code of new Set(catalogue.map(star => star.constellationCode))) {
    const names = constellationNames(code)!;
    const bytes = readFileSync(new URL(`../public${names.illustrationSrc}`, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", code);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", code);
    assert(bytes.length > 10000, `Illustration is unexpectedly small: ${code}`);
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 88, "Each constellation needs its own illustration");
});
