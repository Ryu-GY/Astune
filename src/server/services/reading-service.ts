import { createReadingSchema } from "@/lib/validation/reading";
import { previewReading } from "./preview-service";
export { previewReading } from "./preview-service";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";


export async function createReading(
  input: unknown,
  session: { userId: string }
) {
  const parsed = createReadingSchema.parse(input);
  const preview = await previewReading(parsed);

  const birthProfile =
    parsed.birthProfileId ||
    (parsed.saveBirthProfile
      ? (
          await prisma.birthProfile.create({
            data: {
              userId: session.userId,
              label: parsed.profileLabel || `${parsed.locationName || "출생지"} 프로필`,
              birthAtLocal: parsed.birthAtLocal,
              timezone: parsed.timezone,
              locationName: parsed.locationName,
              latitude: parsed.latitude,
              longitude: parsed.longitude
            }
          })
        ).id
      : null);

  const created = await prisma.reading.create({
    data: {
      userId: session.userId,
      birthProfileId: birthProfile || undefined,
      displayName: parsed.name,
      birthAtLocal: parsed.birthAtLocal,
      timezone: parsed.timezone,
      locationName: parsed.locationName,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      zenithStarHipId: preview.zenithStar.hipId,
      zenithStarName: preview.zenithStar.name,
      constellationCode: preview.zenithStar.constellationCode,
      constellationName: preview.zenithStar.constellationName,
      zenithDistanceDeg: preview.zenithStar.zenithDistanceDeg,
      magnitude: preview.zenithStar.magnitude,
      summary: preview.reading.summary,
      keywordsCsv: preview.reading.keywords.join(","),
      loveText: preview.reading.love,
      careerText: preview.reading.career,
      moneyText: preview.reading.money,
      astronomyMetaJson: JSON.stringify(preview.astronomyMeta),
      interpretationMetaJson: JSON.stringify({
        title: preview.reading.title,
        birthTimeUnknown: preview.input.birthTimeUnknown || false,
        calculationNotice: preview.calculationNotice,
        ...preview.interpretation
      }),
      catalogVersion: preview.astronomyMeta.catalogVersion,
      engineName: preview.astronomyMeta.engineName,
      astroSourceLabel: preview.astronomyMeta.sourceLabel
    }
  });

  return {
    ok: true,
    readingId: created.id,
    preview
  };
}

export async function getReadingById(id: string) {
  const reading = await prisma.reading.findUnique({ where: { id } });

  if (!reading) {
    throw new AppError("리딩을 찾을 수 없습니다.", {
      statusCode: 404,
      code: "READING_NOT_FOUND"
    });
  }

  return {
    ok: true,
    reading
  };
}

export async function createBirthProfile(
  input: unknown,
  session: { userId: string }
) {
  const parsed = createReadingSchema.parse(input);

  if (parsed.birthTimeUnknown) {
    throw new AppError("시간 모름 결과는 참고 리딩으로 보관해 주세요. 출생 프로필에는 실제 출생 시각이 필요합니다.", {
      statusCode: 400, code: "BIRTH_TIME_REQUIRED_FOR_PROFILE"
    });
  }

  await previewReading(parsed); // Validate DST and ephemeris before any database write.
  const created = await prisma.birthProfile.create({
    data: {
      userId: session.userId,
      label: parsed.profileLabel || `${parsed.locationName || "출생지"} 프로필`,
      birthAtLocal: parsed.birthAtLocal,
      timezone: parsed.timezone,
      locationName: parsed.locationName,
      latitude: parsed.latitude,
      longitude: parsed.longitude
    }
  });

  return {
    ok: true,
    birthProfile: created
  };
}

export async function getMyReadings(session: { userId: string }) {
  const readings = await prisma.reading.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return {
    ok: true,
    items: readings
  };
}
