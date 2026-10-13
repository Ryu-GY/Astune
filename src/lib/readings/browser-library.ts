import { z } from "zod";
import type { ReadingPreviewResponse } from "@/types/reading";

const string = z.string();
const number = z.number();
const dimension = z.enum(["personality", "love", "career", "money"]);
const dataSchema = z.object({
  ok: z.literal(true),
  input: z.object({ name: string.optional(), birthAtLocal: string, timezone: string, latitude: number, longitude: number, locationName: string.optional(), maxMagnitude: number.optional(), dstFold: z.union([z.literal(0), z.literal(1)]).optional() }),
  zenithStar: z.object({ hipId: number, name: string, constellationCode: string, constellationName: string, magnitude: number, altitudeDeg: number, azimuthDeg: number, zenithDistanceDeg: number }),
  reading: z.object({ title: string, summary: string, keywords: z.array(string), love: string, career: string, money: string }),
  astronomyMeta: z.object({ sourceLabel: string, catalogVersion: string, engineName: string, candidateCount: number, calculatedAtUtc: string }),
  interpretation: z.object({
    selectedStar: z.object({ id: number, displayName: string, magnitude: number }),
    selectedConstellation: z.object({ id: number.optional(), code: string, nameKo: string, nameEn: string.optional() }),
    metrics: z.object({ zenithDistanceDeg: number, altitudeDeg: number, azimuthDeg: number }),
    ruleVersionId: string, summary: string,
    sections: z.array(z.object({ type: z.enum(["overview", "personality", "love", "career", "money"]), title: string, content: string, sortOrder: number })),
    scores: z.array(z.object({ dimension, score: number, grade: string })),
    matchedRuleIds: z.array(string),
  }),
});
const librarySchema = z.array(z.object({ id: string, savedAt: string, data: dataSchema }));
const STORAGE_KEY = "astune:reading-library:v1";
export type SavedReading = { id: string; savedAt: string; data: ReadingPreviewResponse };

export function loadSavedReadings(): SavedReading[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed = librarySchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error("보관한 리딩을 읽지 못했어요.");
  return parsed.data;
}

export function saveReading(data: ReadingPreviewResponse) {
  const entries = loadSavedReadings();
  const matchingInput = JSON.stringify(data.input);
  const entry: SavedReading = { id: crypto.randomUUID(), savedAt: new Date().toISOString(), data };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...entries.filter(item => JSON.stringify(item.data.input) !== matchingInput)].slice(0, 20)));
}
