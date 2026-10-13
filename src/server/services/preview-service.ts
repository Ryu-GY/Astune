import { requestRepresentativeStar } from "@/lib/astronomy/core-client";
import { previewReadingInputSchema } from "@/lib/validation/reading";
import { validatePreviewRequest } from "@/lib/readings/validation";
import { PreviewReadingService } from "@/lib/readings/preview-reading-service";
import { DEFAULT_INTERPRETATION_RULES, DEFAULT_RULE_VERSION } from "@/lib/readings/fixtures/default-rules";
import { InMemoryRuleRepository } from "@/lib/readings/repositories/in-memory-rule-repository";
import { PrismaRuleRepository } from "@/lib/readings/repositories/prisma-rule-repository";
import type { RuleRepository } from "@/lib/readings/repositories/rule-repository";
import type { ReadingPreviewResponse } from "@/types/reading";
import { birthTimeNotice, referenceTimeWording } from "@/lib/readings/birth-time";
import { traceStage } from "@/lib/utils/request-context";

const builtinRepository = new InMemoryRuleRepository(DEFAULT_RULE_VERSION, DEFAULT_INTERPRETATION_RULES);

export function normalizePreviewInput(input: unknown) {
  if (input && typeof input === "object" && "birthDate" in input) {
    const parsed = validatePreviewRequest(input);
    return previewReadingInputSchema.parse({
      ...input, birthAtLocal: parsed.birthDate + "T" + parsed.birthTimeLocal,
      timezone: parsed.timezone, locationName: parsed.locationName,
      latitude: parsed.latitude, longitude: parsed.longitude, dstFold: parsed.dstFold
    });
  }
  return previewReadingInputSchema.parse(input);
}

export async function previewReading(input: unknown, dependencies: {
  calculate?: typeof requestRepresentativeStar; repository?: RuleRepository;
} = {}): Promise<ReadingPreviewResponse> {
  const parsed = await traceStage("validation", () => normalizePreviewInput(input));
  const { astro, astronomyMeta } = await (dependencies.calculate || requestRepresentativeStar)(parsed);
  let repository = dependencies.repository || builtinRepository;
  if (!dependencies.repository && process.env.ASTUNE_RULE_SOURCE === "database") {
    const { prisma } = await import("@/lib/db/prisma");
    repository = new PrismaRuleRepository(prisma);
  }
  const generated = await traceStage("interpretation", () => new PreviewReadingService(repository).generate({
    input: {
      birthDate: parsed.birthAtLocal.split("T")[0], birthTimeLocal: parsed.birthAtLocal.split("T")[1],
      timezone: parsed.timezone, dstFold: parsed.dstFold, latitude: parsed.latitude, longitude: parsed.longitude,
      locationName: parsed.locationName || "Coordinates"
    }, astro
  }));
  const interpretation = parsed.birthTimeUnknown ? {
    ...generated, summary: referenceTimeWording(generated.summary),
    sections: generated.sections.map(section => ({...section, content: referenceTimeWording(section.content)})),
  } : generated;
  const section = (type: string) => interpretation.sections.find(value => value.type === type)?.content || "";
  return {
    ok: true, input: parsed,
    zenithStar: {
      hipId: astro.selectedStar.id, name: astro.selectedStar.displayName, magnitude: astro.selectedStar.magnitude,
      constellationCode: astro.selectedConstellation.code, constellationName: astro.selectedConstellation.nameKo,
      ...astro.metrics
    },
    reading: {
      title: (parsed.name || "당신") + "의 " + astro.selectedStar.displayName + (parsed.birthTimeUnknown ? " 참고 리딩" : " 리딩"),
      summary: interpretation.summary, keywords: [astro.selectedConstellation.nameKo, astro.selectedStar.displayName],
      love: section("love"), career: section("career"), money: section("money")
    },
    astronomyMeta, interpretation, calculationNotice: birthTimeNotice(parsed.birthTimeUnknown)
  };
}
