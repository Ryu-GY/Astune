import type { BirthProfile, Reading } from "@prisma/client";
import { createReadingSchema, paginationSchema, reuseBirthProfileSchema } from "@/lib/validation/reading";
import { previewReading } from "./preview-service";
export { previewReading } from "./preview-service";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import type { ReadingPreviewResponse, PreviewReadingInput } from "@/types/reading";
import type { PreviewReadingResult } from "@/lib/readings/types";
import { birthTimeNotice } from "@/lib/readings/birth-time";
import { DEFAULT_READING_MAX_MAGNITUDE } from "@/lib/readings/coverage";

function notFound(kind: "READING" | "PROFILE"): never {
  throw new AppError("저장한 정보를 찾을 수 없습니다.", { statusCode: 404, code: `${kind}_NOT_FOUND` });
}
export function profileInput(profile: BirthProfile): PreviewReadingInput {
  return {
    name: profile.displayName ?? undefined, birthAtLocal: profile.birthAtLocal, timezone: profile.timezone,
    locationName: profile.locationName ?? undefined, latitude: profile.latitude, longitude: profile.longitude,
    dstFold: profile.dstFold === 0 || profile.dstFold === 1 ? profile.dstFold : undefined,
    maxMagnitude: profile.maxMagnitude,
  };
}
function profileData(input: PreviewReadingInput, userId: string, label?: string) {
  return {
    userId, label: label || `${input.name || input.locationName || "출생지"} 프로필`,
    displayName: input.name, birthAtLocal: input.birthAtLocal, timezone: input.timezone,
    locationName: input.locationName, latitude: input.latitude, longitude: input.longitude,
    dstFold: input.dstFold, maxMagnitude: input.maxMagnitude ?? DEFAULT_READING_MAX_MAGNITUDE,
  };
}

export async function createReading(input: unknown, session: { userId: string }) {
  let birthProfileId: string | null = null;
  let saveProfile = false;
  let label: string | undefined;
  let calculationInput: PreviewReadingInput;
  if (input && typeof input === "object" && "birthProfileId" in input) {
    const reference = reuseBirthProfileSchema.parse(input);
    const profile = await prisma.birthProfile.findFirst({ where: { id: reference.birthProfileId, userId: session.userId } });
    if (!profile) notFound("PROFILE");
    birthProfileId = profile.id;
    calculationInput = profileInput(profile);
  } else {
    const parsed = createReadingSchema.parse(input);
    calculationInput = parsed;
    saveProfile = parsed.saveBirthProfile;
    label = parsed.profileLabel;
  }
  const preview = await previewReading(calculationInput);
  const normalized = preview.input;
  const created = await prisma.$transaction(async tx => {
    if (birthProfileId && !await tx.birthProfile.findFirst({ where: { id: birthProfileId, userId: session.userId } })) notFound("PROFILE");
    if (saveProfile) birthProfileId = (await tx.birthProfile.create({ data: profileData(normalized, session.userId, label) })).id;
    return tx.reading.create({ data: {
      userId: session.userId, birthProfileId, displayName: normalized.name,
      birthAtLocal: normalized.birthAtLocal, timezone: normalized.timezone, locationName: normalized.locationName,
      latitude: normalized.latitude, longitude: normalized.longitude, dstFold: normalized.dstFold,
      maxMagnitude: normalized.maxMagnitude ?? DEFAULT_READING_MAX_MAGNITUDE, birthTimeUnknown: normalized.birthTimeUnknown ?? false,
      inputSnapshotJson: JSON.stringify(normalized), previewSnapshotJson: JSON.stringify(preview),
      zenithStarHipId: preview.zenithStar.hipId, zenithStarName: preview.zenithStar.name,
      constellationCode: preview.zenithStar.constellationCode, constellationName: preview.zenithStar.constellationName,
      zenithDistanceDeg: preview.zenithStar.zenithDistanceDeg, magnitude: preview.zenithStar.magnitude,
      summary: preview.reading.summary, keywordsCsv: preview.reading.keywords.join(","),
      loveText: preview.reading.love, careerText: preview.reading.career, moneyText: preview.reading.money,
      astronomyMetaJson: JSON.stringify(preview.astronomyMeta),
      interpretationMetaJson: JSON.stringify({ title: preview.reading.title, birthTimeUnknown: normalized.birthTimeUnknown ?? false, calculationNotice: preview.calculationNotice, ...preview.interpretation }),
      catalogVersion: preview.astronomyMeta.catalogVersion, engineName: preview.astronomyMeta.engineName, astroSourceLabel: preview.astronomyMeta.sourceLabel,
    } });
  });
  return { ok: true, readingId: created.id, birthProfileId: created.birthProfileId, preview };
}

// Old rows retain their original interpretation, never regenerate from today's rules.
export function restoreReading(reading: Reading): ReadingPreviewResponse {
  if (reading.previewSnapshotJson) return JSON.parse(reading.previewSnapshotJson) as ReadingPreviewResponse;
  const interpretation = JSON.parse(reading.interpretationMetaJson) as PreviewReadingResult & { title?: string; birthTimeUnknown?: boolean };
  if (!interpretation.metrics || !interpretation.sections) throw new AppError("이전 리딩의 전체 해석 정보가 없습니다.", { statusCode: 409, code: "READING_SNAPSHOT_INCOMPLETE" });
  const unknown = interpretation.birthTimeUnknown ?? reading.birthTimeUnknown;
  const input: PreviewReadingInput = reading.inputSnapshotJson ? JSON.parse(reading.inputSnapshotJson) : {
    name: reading.displayName ?? undefined, birthAtLocal: reading.birthAtLocal, birthTimeUnknown: unknown,
    timezone: reading.timezone, locationName: reading.locationName ?? undefined, latitude: reading.latitude, longitude: reading.longitude,
    dstFold: reading.dstFold === 0 || reading.dstFold === 1 ? reading.dstFold : undefined, maxMagnitude: reading.maxMagnitude,
  };
  return {
    ok: true, input, interpretation, calculationNotice: birthTimeNotice(unknown),
    astronomyMeta: JSON.parse(reading.astronomyMetaJson),
    zenithStar: { hipId: reading.zenithStarHipId, name: reading.zenithStarName, constellationCode: reading.constellationCode,
      constellationName: reading.constellationName, magnitude: reading.magnitude, ...interpretation.metrics },
    reading: { title: interpretation.title || `${reading.zenithStarName} 리딩`, summary: reading.summary,
      keywords: reading.keywordsCsv.split(",").filter(Boolean), love: reading.loveText, career: reading.careerText, money: reading.moneyText },
  };
}

export async function getReadingById(id: string, session: { userId: string; role: "USER" | "ADMIN" }) {
  // Administrators manage rules, but private readings stay owner-only.
  const reading = await prisma.reading.findFirst({ where: { id, userId: session.userId } });
  if (!reading) notFound("READING");
  return { ok: true, reading: { id: reading.id, birthProfileId: reading.birthProfileId, createdAt: reading.createdAt },
    preview: restoreReading(reading), legacySnapshot: !reading.previewSnapshotJson };
}
export async function createBirthProfile(input: unknown, session: { userId: string }) {
  const parsed = createReadingSchema.parse(input);
  if (parsed.birthTimeUnknown || parsed.birthProfileId) throw new AppError("출생 프로필에는 실제 출생 시각을 입력해 주세요.", { statusCode: 400, code: "BIRTH_TIME_REQUIRED_FOR_PROFILE" });
  const preview = await previewReading(parsed); // Validate DST folds and skipped local times before saving.
  const created = await prisma.birthProfile.create({ data: profileData(preview.input, session.userId, parsed.profileLabel) });
  return { ok: true, birthProfile: { ...created, input: profileInput(created) } };
}
export async function getMyBirthProfiles(session: { userId: string }, query: unknown = {}) {
  const { page, pageSize } = paginationSchema.parse(query);
  const where = { userId: session.userId };
  const [items, total] = await prisma.$transaction([
    prisma.birthProfile.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.birthProfile.count({ where }),
  ]);
  return { ok: true, items: items.map(item => ({ ...item, input: profileInput(item) })), page, pageSize, total };
}
export async function getBirthProfileById(id: string, session: { userId: string }) {
  const profile = await prisma.birthProfile.findFirst({ where: { id, userId: session.userId } });
  if (!profile) notFound("PROFILE");
  return { ok: true, birthProfile: { id: profile.id, label: profile.label, input: profileInput(profile) } };
}
export async function getMyReadings(session: { userId: string }, query: unknown = {}) {
  const { page, pageSize } = paginationSchema.parse(query);
  const where = { userId: session.userId };
  const [items, total] = await prisma.$transaction([
    prisma.reading.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize,
      select: { id: true, createdAt: true, displayName: true, birthAtLocal: true, birthTimeUnknown: true, locationName: true, zenithStarName: true, constellationName: true, summary: true } }),
    prisma.reading.count({ where }),
  ]);
  return { ok: true, items, page, pageSize, total };
}
