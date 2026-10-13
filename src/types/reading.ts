export type PreviewReadingInput = {
  name?: string;
  birthAtLocal: string;
  birthTimeUnknown?: boolean;
  timezone: string;
  latitude: number;
  longitude: number;
  locationName?: string;
  maxMagnitude?: number;
  dstFold?: 0 | 1;
};

export type ZenithStar = {
  hipId: number;
  name: string;
  constellationCode: string;
  constellationName: string;
  magnitude: number;
  altitudeDeg: number;
  azimuthDeg: number;
  zenithDistanceDeg: number;
};

export type ReadingBody = {
  title: string;
  summary: string;
  keywords: string[];
  love: string;
  career: string;
  money: string;
};

export type AstronomyMeta = {
  sourceLabel: string;
  catalogVersion: string;
  engineName: string;
  candidateCount: number;
  calculatedAtUtc: string;
};

export type ReadingPreviewResponse = {
  ok: true;
  input: PreviewReadingInput;
  zenithStar: ZenithStar;
  reading: ReadingBody;
  astronomyMeta: AstronomyMeta;
  interpretation: PreviewReadingResult;
  calculationNotice?: { code: "BIRTH_TIME_UNKNOWN"; referenceTimeLocal: string; message: string };
};
import type { PreviewReadingResult } from "@/lib/readings/types";
