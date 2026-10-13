import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_INTERPRETATION_RULES, DEFAULT_RULE_VERSION } from "../src/lib/readings/fixtures/default-rules";
import { InMemoryRuleRepository } from "../src/lib/readings/repositories/in-memory-rule-repository";
import { PreviewReadingService } from "../src/lib/readings/preview-reading-service";
import { previewReading, normalizePreviewInput } from "../src/server/services/preview-service";
import { requestRepresentativeStar } from "../src/lib/astronomy/core-client";
import { toPersistenceRows } from "../src/lib/readings/persistence-mapper";
import type { AstroResult } from "../src/lib/readings/types";
import { interpretationRuleInputSchema } from "../src/lib/validation/rule";
import { RuleBasedInterpretationEngine } from "../src/lib/readings/interpreter";

const input = { birthDate: "1995-05-05", birthTimeLocal: "15:00:00", timezone: "Asia/Seoul", locationName: "Seoul", latitude: 37.5665, longitude: 126.978 };
const astro: AstroResult = {
  selectedStar: { id: 27989, displayName: "Betelgeuse", magnitude: 0.5 },
  selectedConstellation: { code: "Ori", nameKo: "오리온자리" },
  metrics: { altitudeDeg: 65, zenithDistanceDeg: 25, azimuthDeg: 170 },
  astronomyMeta: { sourceLabel: "fixture", catalogVersion: "test", engineName: "Skyfield" }
};
const repository = new InMemoryRuleRepository(DEFAULT_RULE_VERSION, DEFAULT_INTERPRETATION_RULES);

test("all five sections come from the selected star with stable scores", async () => {
  const result = await new PreviewReadingService(repository).generate({ input, astro });
  assert.equal(result.sections.length, 5);
  assert(result.sections.every(s => s.sourceRuleId === "ir_star_27989_v3" && s.sourceScope === "star"));
  assert.equal(result.scores.length, 4);
  assert(result.scores.every(s => s.score >= 0 && s.score <= 100));
  assert(!result.sections.some(s => /\{\w+\}/.test(s.content)));
  const rows = toPersistenceRows({ requestMode: "preview", input, result, generatedAt: new Date("2026-01-01T00:00:00Z") });
  assert.equal(rows.reading.selectedStarId, 27989);
  assert.equal(rows.sections.length, 5);
});

test("Rigel never receives the Betelgeuse star rule", async () => {
  const bundle = await repository.getPublishedRuleBundle({ starId: 24436, constellationCode: "Ori" });
  assert(bundle);
  assert(!bundle.rules.some(rule => rule.starId === 27989));
  assert(bundle.rules.some(rule => rule.starId === 24436));
  assert(!bundle.rules.some(rule => rule.scopeType === "constellation"));
});

test("interpreter rejects inactive versions and excludes unrelated rules from text, scores and IDs", () => {
  const engine = new RuleBasedInterpretationEngine();
  for (const status of ["DRAFT", "ARCHIVED"] as const) {
    assert.throws(() => engine.interpret({ astro, rules: DEFAULT_INTERPRETATION_RULES, version: { ...DEFAULT_RULE_VERSION, status } }), { code: "RULE_VERSION_NOT_FOUND" });
  }
  const expected = engine.interpret({ astro, rules: DEFAULT_INTERPRETATION_RULES, version: DEFAULT_RULE_VERSION });
  const unrelated = { ...DEFAULT_INTERPRETATION_RULES[0], id: "other-version", ruleVersionId: "draft", priority: 32767, templates: { overview: "노출 금지" } };
  const result = engine.interpret({ astro, rules: [unrelated, ...DEFAULT_INTERPRETATION_RULES].reverse(), version: DEFAULT_RULE_VERSION });
  assert.deepEqual(result, expected);
  const fallback = engine.interpret({ astro, rules: [], version: DEFAULT_RULE_VERSION });
  assert(fallback.sections.every(section => section.sourceScope === "default" && section.content.length > 0));
  assert.deepEqual(fallback.matchedRuleIds, []);
});

test("rule input accepts legacy fields and validates scopes, priorities and template variables", () => {
  const legacy = interpretationRuleInputSchema.parse({ title: "공통 규칙", constellationCode: "default", generalText: "{starName} 총평" });
  assert.equal(legacy.scopeType, "global");
  assert.equal(legacy.constellationCode, null);
  assert.equal(legacy.templates.overview, "{starName} 총평");
  const valid = { title: "별 규칙", scopeType: "star", starId: 27989, templates: { personality: "{starName} 성향" } };
  assert(interpretationRuleInputSchema.safeParse(valid).success);
  for (const patch of [
    { starId: null }, { starId: -1 }, { constellationCode: "Ori" }, { priority: 1.5 }, { priority: 32768 },
    { templates: {} }, { templates: { overview: "   " } }, { templates: { overview: "{unknown} 잘못된 변수" } },
    { templates: { unknown: "오타 섹션" } }, { keywords: ["a,b"] }
  ]) assert(!interpretationRuleInputSchema.safeParse({ ...valid, ...patch }).success, JSON.stringify(patch));
});

test("missing constellation IDs do not match each other", async () => {
  const repo = new InMemoryRuleRepository(DEFAULT_RULE_VERSION, [{ ...DEFAULT_INTERPRETATION_RULES[1], constellationCode: null, constellationId: null }]);
  const bundle = await repo.getPublishedRuleBundle({ starId: 1 });
  assert.equal(bundle?.rules.length, 0);
});

test("both existing form and baseline input reach the same interpreter", async () => {
  const calculate = async () => ({ astro, astronomyMeta: { sourceLabel: "fixture", engineName: "Skyfield", catalogVersion: "test", candidateCount: 10, calculatedAtUtc: "1995-05-05T06:00:00Z" } });
  const legacy = { birthAtLocal: "1995-05-05T15:00:00", timezone: "Asia/Seoul", latitude: input.latitude, longitude: input.longitude };
  const result = await previewReading(legacy, { calculate, repository });
  const baseline = await previewReading(input, { calculate, repository });
  assert.equal(result.zenithStar.hipId, 27989);
  assert.equal(result.interpretation.sections.length, 5);
  assert.deepEqual(result.interpretation, baseline.interpretation);
});

test("invalid dates, offsets, coordinates and timezones are rejected", () => {
  for (const patch of [{ birthDate: "2024-02-31" }, { birthTimeLocal: "24:00" }, { birthTimeLocal: "12:00+09:00" }, { latitude: Infinity }, { timezone: "Invalid/Zone" }]) {
    assert.throws(() => normalizePreviewInput({ ...input, ...patch }));
  }
});

test("preview magnitude cannot exceed the shipped Hipparcos coverage", () => {
  assert.equal(normalizePreviewInput(input).maxMagnitude, 2.5);
  assert.equal(normalizePreviewInput({ ...input, maxMagnitude: 5.5 }).maxMagnitude, 5.5);
  assert.throws(() => normalizePreviewInput({ ...input, maxMagnitude: 5.6 }));
  assert.throws(() => normalizePreviewInput({ ...input, maxMagnitude: -2.1 }));
});

test("core client maps snake_case and preserves upstream errors", async () => {
  const legacy = normalizePreviewInput(input);
  let sent: Record<string, unknown> = {};
  const mockFetch: typeof fetch = async (_url, options) => {
    sent = JSON.parse(String(options?.body));
    return Response.json({ success: true, data: {
      selected_star: { id: 27989, display_name: "Betelgeuse", magnitude: 0.5 },
      selected_constellation: { code: "Ori", name_ko: null, name_en: "Orion" },
      metrics: { altitude_deg: 65, azimuth_deg: 170, zenith_distance_deg: 25 },
      astronomy_meta: { source_label: "test", catalog_version: "test", engine_name: "Skyfield", candidate_count: 1, calculated_at_utc: "1995-05-05T06:00:00Z" }
    } });
  };
  const result = await requestRepresentativeStar(legacy, mockFetch);
  assert.equal(sent.birth_time_local, "15:00:00");
  assert.equal(result.astro.selectedStar.id, 27989);
  const invalidTime: typeof fetch = async () => Response.json({ error: { code: "LOCAL_TIME_AMBIGUOUS", message: "Choose fold" } }, { status: 422 });
  await assert.rejects(requestRepresentativeStar(legacy, invalidTime), { code: "LOCAL_TIME_AMBIGUOUS", statusCode: 422 });
  const unavailable: typeof fetch = async () => { throw new Error("unavailable"); };
  await assert.rejects(requestRepresentativeStar(legacy, unavailable), { code: "ASTRO_SERVICE_UNAVAILABLE", statusCode: 503 });
  const malformed: typeof fetch = async () => Response.json({ success: true, data: {} });
  await assert.rejects(requestRepresentativeStar(legacy, malformed), { code: "ASTRO_INVALID_RESPONSE", statusCode: 502 });
});
