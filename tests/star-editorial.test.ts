import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RuleBasedInterpretationEngine } from "../src/lib/readings/interpreter";
import { DEFAULT_INTERPRETATION_RULES, DEFAULT_RULE_VERSION } from "../src/lib/readings/fixtures/default-rules";
import { DEFAULT_READING_MAX_MAGNITUDE } from "../src/lib/readings/coverage";
import { buildReading } from "../src/lib/reading/interpreter";
import type { AstroResult } from "../src/lib/readings/types";

const catalog = JSON.parse(readFileSync("data/astro/bright-stars.json", "utf8")) as {
  hipId: number; name: string; constellationCode: string; magnitude: number;
}[];
const candidates = catalog.filter(s => s.magnitude <= DEFAULT_READING_MAX_MAGNITUDE);
const engine = new RuleBasedInterpretationEngine();
function astronomy(id: number): AstroResult {
  const star = catalog.find(s => s.hipId === id)!;
  return {
    selectedStar: { id, displayName: star.name, magnitude: star.magnitude },
    selectedConstellation: { code: star.constellationCode, nameKo: star.constellationCode },
    metrics: { altitudeDeg: 70, azimuthDeg: 180, zenithDistanceDeg: 20 },
  };
}
const interpret = (astro: AstroResult, rules = DEFAULT_INTERPRETATION_RULES) =>
  engine.interpret({ astro, rules, version: DEFAULT_RULE_VERSION });

test("expanded calculation catalog has exactly one complete individual portrait per star", () => {
  assert.equal(catalog.filter(s => s.magnitude <= 2).length, 49);
  assert.equal(candidates.length, 93);
  const rules = DEFAULT_INTERPRETATION_RULES.filter(r => r.scopeType === "star");
  assert.equal(rules.length, 93);
  assert.equal(new Set(rules.map(r => r.starId)).size, 93);
  assert.deepEqual(rules.map(r => r.starId).sort((a, b) => a! - b!), candidates.map(s => s.hipId).sort((a, b) => a - b));
  assert(!DEFAULT_INTERPRETATION_RULES.some(r => r.scopeType === "constellation"));
});

test("each star has substantive distinct explanations in all five sections, without advice", () => {
  const sectionFingerprints = new Map<string, Set<string>>();
  for (const star of candidates) {
    const result = interpret(astronomy(star.hipId));
    assert.equal(result.sections.length, 5);
    for (const section of result.sections) {
      const label = `${star.hipId}/${section.type}`;
      assert.equal(section.sourceRuleId, `ir_star_${star.hipId}_v3`, label);
      assert.equal(section.sourceScope, "star", label);
      assert(section.content.length >= 400, label);
      assert.equal(section.content.split(/\n\s*\n/).length, 3, label);
      assert(!/[{}]/.test(section.content), label);
      assert(!/이번 주|오늘의 과제|보세요|하세요|해 주세요|해야 합니다|하는 것이 좋습니다|권합니다|추천합니다/.test(section.content), label);
      assert(!/별자리|성좌|오리온|마차부|거문고|처녀자리|전갈자리/.test(section.content), label);
      const fingerprint = section.content.replaceAll(star.name, "STAR");
      const seen = sectionFingerprints.get(section.type) || new Set<string>();
      assert(!seen.has(fingerprint), `${label}: name substitution must not create a portrait`);
      seen.add(fingerprint); sectionFingerprints.set(section.type, seen);
    }
  }
});

test("constellation metadata cannot change individual interpretation, rule IDs or scores", () => {
  for (const id of [24608, 27989, 24436, 9884]) {
    const original = astronomy(id);
    const first = interpret(original);
    const changed = interpret({ ...original, selectedConstellation: { id: 999, code: "Other", nameKo: "다른 표기" } });
    assert.deepEqual(changed.sections, first.sections);
    assert.deepEqual(changed.scores, first.scores);
    assert.deepEqual(changed.matchedRuleIds, first.matchedRuleIds);
    assert.equal(changed.summary, first.summary);
  }
  for (const [left, right] of [[24608, 28360], [27989, 24436], [37826, 36850]]) {
    assert.equal(astronomy(left).selectedConstellation.code, astronomy(right).selectedConstellation.code);
    const a = interpret(astronomy(left)); const b = interpret(astronomy(right));
    for (let index = 0; index < 5; index++) assert.notEqual(a.sections[index].content, b.sections[index].content);
  }
});

test("missing individual content is explicit and cannot inherit a legacy constellation portrait", () => {
  const astro = { ...astronomy(24608), selectedStar: { id: 999999, displayName: "Unknown", magnitude: 4 } };
  const legacy = { ...DEFAULT_INTERPRETATION_RULES[0], id: "legacy-aur", scopeType: "constellation" as const,
    constellationCode: "Aur", priority: 32767, keywords: ["추진력"], templates: { career: "별자리로 대신 해석하는 잘못된 본문" } };
  const result = interpret(astro, [...DEFAULT_INTERPRETATION_RULES, legacy]);
  assert(result.sections.every(s => s.content.includes("준비되지 않았습니다")));
  assert(!result.matchedRuleIds.includes(legacy.id));
  assert.deepEqual(result.scores, interpret(astro).scores);
  assert(interpret(astro, []).sections.every(s => s.sourceScope === "default" && s.content.includes("준비되지 않았습니다")));
});

test("legacy reading entry point also resolves Capella by HIP, not by constellation", () => {
  const star = { hipId: 24608, name: "Capella", magnitude: 0.08, constellationCode: "Aur", constellationName: "마차부자리",
    altitudeDeg: 70, azimuthDeg: 180, zenithDistanceDeg: 20 };
  const reading = buildReading(star);
  assert.deepEqual(reading, buildReading({ ...star, constellationCode: "Ori", constellationName: "오리온자리" }));
  assert.equal(reading.career, interpret(astronomy(24608)).sections[3].content);
});
