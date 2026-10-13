import { test } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { testDatabase } from "./helpers/database";
import { PrismaRuleRepository } from "../src/lib/readings/repositories/prisma-rule-repository";
import { InMemoryRuleRepository } from "../src/lib/readings/repositories/in-memory-rule-repository";
import { PreviewReadingService } from "../src/lib/readings/preview-reading-service";
import { previewReading } from "../src/server/services/preview-service";
import { createInterpretationRule } from "../src/server/services/admin-service";
import { publishRules } from "../src/server/services/rule-publishing";
import { seedDefaultRules } from "../prisma/seed-rules";
import { DEFAULT_INTERPRETATION_RULES, DEFAULT_RULE_VERSION } from "../src/lib/readings/fixtures/default-rules";
import type { AstroResult } from "../src/lib/readings/types";

const input = { birthDate: "1995-05-05", birthTimeLocal: "15:00:00", timezone: "Asia/Seoul", locationName: "Seoul", latitude: 37.5, longitude: 127 };
const astro: AstroResult = {
  selectedStar: { id: 27989, displayName: "Betelgeuse", magnitude: 0.5 },
  selectedConstellation: { code: "Ori", nameKo: "오리온자리" },
  metrics: { altitudeDeg: 65, azimuthDeg: 170, zenithDistanceDeg: 25 }
};
const textRule = { title: "Test", keywordsCsv: "몰입", generalText: "게시된 {starName} 해석", loveText: "", careerText: "", moneyText: "" };

test("all 93 seeded stars and unavailable fallback match builtin output through preview", async t => {
  const db = testDatabase(); t.after(() => db.cleanup());
  const admin = await db.prisma.user.create({ data: { email: "seed@astune.local", role: "ADMIN" } });
  assert.equal((await seedDefaultRules(db.prisma, admin.id)).status, "PUBLISHED");
  await seedDefaultRules(db.prisma, admin.id);
  assert.equal(await db.prisma.interpretationRule.count(), DEFAULT_INTERPRETATION_RULES.length);
  assert.equal(await db.prisma.adminAuditLog.count({ where: { action: "RULE_VERSION_PUBLISHED" } }), 1);
  const builtin = new InMemoryRuleRepository(DEFAULT_RULE_VERSION, DEFAULT_INTERPRETATION_RULES);
  const database = new PrismaRuleRepository(db.prisma);
  const ids = DEFAULT_INTERPRETATION_RULES.filter(r => r.scopeType === "star").map(r => r.starId!);
  assert.equal(new Set(ids).size, 93);
  for (const id of [...ids, 1]) {
    const selected = { ...astro, selectedStar: { ...astro.selectedStar, id } };
    const calculate = async () => ({ astro: selected, astronomyMeta: { sourceLabel: "fixture", engineName: "Skyfield", catalogVersion: "test", candidateCount: 1, calculatedAtUtc: "1995-05-05T06:00:00Z" } });
    const memoryResult = await previewReading(input, { calculate, repository: builtin });
    const dbResult = await previewReading(input, { calculate, repository: database });
    assert.deepEqual(dbResult, memoryResult, String(id));
    assert.equal(dbResult.interpretation.sections.length, 5);
    assert.equal(dbResult.interpretation.scores.length, 4);
    assert(dbResult.interpretation.sections.every(s => s.content.length > 20 && !/[{}]/.test(s.content)));
    const expectedId = id === 1 ? "ir_global_unavailable_v3" : `ir_star_${id}_v3`;
    assert(dbResult.interpretation.sections.every(s => s.sourceRuleId === expectedId), String(id));
  }
  assert.deepEqual(
    await new PreviewReadingService(database).generate({ input, astro }),
    await new PreviewReadingService(builtin).generate({ input, astro })
  );
});

test("DB star scope beats global priority; legacy constellation text and scores are ignored", async t => {
  const db = testDatabase(); t.after(() => db.cleanup());
  const admin = await db.prisma.user.create({ data: { email: "priority@astune.local", role: "ADMIN" } });
  const version = await db.prisma.ruleVersion.create({ data: { name: "priority", createdById: admin.id } });
  const rules = [
    { id: "global", scopeType: "global" as const, priority: 32767, personalityText: "공통 성향", careerText: "공통 일", moneyText: "공통 재물" },
    { id: "const-low", scopeType: "constellation" as const, constellationCode: "Ori", priority: 10, careerText: "낮은 성좌 우선순위" },
    { id: "const-z", scopeType: "constellation" as const, constellationCode: "Ori", priority: 20, careerText: "동점 뒤 ID" },
    { id: "const-a", scopeType: "constellation" as const, constellationCode: "Ori", priority: 20, keywordsCsv: "리더십,추진력", careerText: "성좌 우선순위 선택" },
    { id: "star", scopeType: "star" as const, starId: 27989, priority: -10, generalText: "별 {starName}", personalityText: "별 성향", loveText: "별 연애" },
    { id: "wrong-star", scopeType: "star" as const, starId: 24436, priority: 200, generalText: "선택되면 안 됨" },
    { id: "wrong-const", scopeType: "constellation" as const, constellationCode: "Lyr", priority: 300, generalText: "선택되면 안 됨" }
  ];
  await db.prisma.interpretationRule.createMany({ data: rules.map(rule => ({ ...textRule, ...rule, ruleVersionId: version.id })) });
  const service = new PreviewReadingService(new PrismaRuleRepository(db.prisma));
  await assert.rejects(service.generate({ input, astro }), { code: "RULE_VERSION_NOT_FOUND" });
  await publishRules(db.prisma, version.id, admin.id);
  const result = await service.generate({ input, astro });
  assert.deepEqual(result.sections.map(s => s.sourceRuleId), ["star", "star", "star", "global", "global"]);
  assert.equal(result.sections[3].content, "공통 일");
  assert(!result.matchedRuleIds.some(id => id.startsWith("const-")));
  assert(!result.matchedRuleIds.some(id => id.startsWith("wrong")));
  assert.equal(result.summary, "별 Betelgeuse");
  const next = await db.prisma.ruleVersion.create({ data: {
    name: "next", createdById: admin.id,
    rules: { create: { ...textRule, scopeType: "global", generalText: "다음 게시 버전" } }
  } });
  assert.equal((await service.generate({ input, astro })).ruleVersionId, version.id);
  await publishRules(db.prisma, next.id, admin.id);
  assert.equal((await service.generate({ input, astro })).summary, "다음 게시 버전");
  assert.equal((await db.prisma.ruleVersion.findUniqueOrThrow({ where: { id: version.id } })).status, "ARCHIVED");
});

test("SQL constraints reject a second published version and invalid scope or priority", async t => {
  const db = testDatabase(); t.after(() => db.cleanup());
  const admin = await db.prisma.user.create({ data: { email: "constraints@astune.local" } });
  const version = await db.prisma.ruleVersion.create({ data: { name: "active", status: "PUBLISHED", createdById: admin.id } });
  await assert.rejects(db.prisma.ruleVersion.create({ data: { name: "duplicate", status: "PUBLISHED", createdById: admin.id } }), { code: "P2002" });
  for (const patch of [
    { scopeType: "star" as const }, { scopeType: "star" as const, starId: -1 },
    { scopeType: "global" as const, constellationCode: "Ori" },
    { scopeType: "constellation" as const, constellationCode: "default" },
    { scopeType: "constellation" as const, constellationCode: "Ori", starId: 1 },
    { scopeType: "global" as const, priority: 32768 }
  ]) await assert.rejects(db.prisma.interpretationRule.create({ data: { ...textRule, ruleVersionId: version.id, ...patch } }));
  await assert.rejects(db.prisma.$executeRaw`INSERT INTO "InterpretationRule"
    ("id", "ruleVersionId", "scopeType", "priority", "title", "keywordsCsv", "generalText", "loveText", "careerText", "moneyText", "updatedAt")
    VALUES ('fractional', ${version.id}, 'global', 1.5, 'Test', '', 'Test', '', '', '', CURRENT_TIMESTAMP)`);
  assert.equal(await db.prisma.interpretationRule.count(), 0);
});

test("concurrent publishers leave one active version; failed publication rolls back", async t => {
  const db = testDatabase();
  const other = new PrismaClient({ datasources: { db: { url: db.databaseUrl } } });
  t.after(async () => { await other.$disconnect(); await db.cleanup(); });
  const admin = await db.prisma.user.create({ data: { email: "publish@astune.local" } });
  const makeVersion = (name: string) => db.prisma.ruleVersion.create({ data: {
    name, createdById: admin.id, rules: { create: { ...textRule, scopeType: "global" } }
  } });
  const [first, second] = await Promise.all([makeVersion("first"), makeVersion("second")]);
  const outcomes = await Promise.allSettled([publishRules(db.prisma, first.id, admin.id), publishRules(other, second.id, admin.id)]);
  assert(outcomes.some(outcome => outcome.status === "fulfilled"));
  for (const outcome of outcomes) if (outcome.status === "rejected") assert.equal(outcome.reason.code, "RULE_PUBLISH_CONFLICT");
  assert.equal(await db.prisma.ruleVersion.count({ where: { status: "PUBLISHED" } }), 1);
  const active = await db.prisma.ruleVersion.findFirstOrThrow({ where: { status: "PUBLISHED" } });
  const logCount = await db.prisma.adminAuditLog.count();
  const publicationCount = await db.prisma.adminAuditLog.count({ where: { action: "RULE_VERSION_PUBLISHED" } });
  await publishRules(db.prisma, active.id, admin.id);
  assert.equal(await db.prisma.adminAuditLog.count(), logCount);
  const empty = await db.prisma.ruleVersion.create({ data: { name: "empty", createdById: admin.id } });
  await assert.rejects(publishRules(db.prisma, empty.id, admin.id), { code: "INVALID_RULE_INPUT" });
  await assert.rejects(publishRules(db.prisma, "missing", admin.id), { code: "RULE_VERSION_NOT_FOUND" });
  const broken = await makeVersion("audit-failure");
  await assert.rejects(publishRules(db.prisma, broken.id, "missing-admin"));
  await db.prisma.interpretationRule.updateMany({ where: { ruleVersionId: broken.id }, data: { generalText: "{unknown} 변수" } });
  await assert.rejects(publishRules(db.prisma, broken.id, admin.id), { code: "INVALID_RULE_INPUT" });
  assert.equal((await db.prisma.ruleVersion.findFirstOrThrow({ where: { status: "PUBLISHED" } })).id, active.id);
  assert.equal(await db.prisma.adminAuditLog.count({ where: { action: "RULE_VERSION_PUBLISHED" } }), publicationCount);
  // Failed attempts are audited separately; they must not create successful publication records.
  assert.equal(await db.prisma.adminAuditLog.count({ where: {
    action: "RULE_VERSION_PUBLISH_FAILED", targetId: { in: [empty.id, "missing", broken.id] }
  } }), 3);
  assert.equal((await db.prisma.ruleVersion.findUniqueOrThrow({ where: { id: broken.id } })).status, "DRAFT");
});

test("admin writes persist star fields, protect published snapshots and roll back on audit failure", async t => {
  const db = testDatabase(); t.after(() => db.cleanup());
  const admin = await db.prisma.user.create({ data: { email: "write@astune.local" } });
  const version = await db.prisma.ruleVersion.create({ data: { name: "write", createdById: admin.id } });
  const command = { ruleVersionId: version.id, adminUserId: admin.id, scopeType: "star" as const, starId: 27989, priority: 123, title: "별 규칙", templates: { personality: "별의 성향 문구" } };
  const { rule } = await createInterpretationRule(command, db.prisma);
  assert.equal(rule.starId, 27989);
  assert.equal(rule.priority, 123);
  assert.equal(rule.personalityText, "별의 성향 문구");
  await assert.rejects(createInterpretationRule({ ...command, adminUserId: "missing" }, db.prisma));
  assert.equal(await db.prisma.interpretationRule.count(), 1);
  await publishRules(db.prisma, version.id, admin.id);
  await assert.rejects(createInterpretationRule(command, db.prisma), { code: "RULE_VERSION_NOT_DRAFT" });
  await seedDefaultRules(db.prisma, admin.id);
  assert.equal((await db.prisma.ruleVersion.findFirstOrThrow({ where: { status: "PUBLISHED" } })).id, version.id);
  assert.equal((await db.prisma.ruleVersion.findUniqueOrThrow({ where: { id: DEFAULT_RULE_VERSION.id } })).status, "DRAFT");
});

test("legacy migration preserves data, maps default scope, and archives duplicate publications", async t => {
  const db = testDatabase(true); t.after(() => db.cleanup());
  // Build the historical row using its historical columns, independent of today's generated client.
  const admin = { id: "legacy-admin" };
  await db.prisma.$executeRaw`INSERT INTO "User" ("id", "email", "updatedAt")
    VALUES (${admin.id}, 'legacy@astune.local', CURRENT_TIMESTAMP)`;
  for (const [id, date] of [["older", "2026-01-01"], ["newer", "2026-02-01"]]) {
    await db.prisma.ruleVersion.create({ data: { id, name: id, status: "PUBLISHED", publishedAt: new Date(date), createdById: admin.id } });
  }
  for (const [id, code] of [["legacy-global", "default"], ["legacy-ori", "Ori"]]) {
    await db.prisma.$executeRaw`INSERT INTO "InterpretationRule"
      ("id", "ruleVersionId", "constellationCode", "title", "keywordsCsv", "generalText", "loveText", "careerText", "moneyText", "updatedAt")
      VALUES (${id}, 'newer', ${code}, '보존할 제목', '균형', '보존할 총평', '연애', '일', '재물', CURRENT_TIMESTAMP)`;
  }
  db.migrate();
  const rules = await db.prisma.interpretationRule.findMany({ orderBy: { id: "asc" } });
  assert.equal(rules.length, 2);
  assert.deepEqual(rules.map(rule => [rule.scopeType, rule.constellationCode, rule.priority]), [["global", null, 10], ["constellation", "Ori", 100]]);
  assert(rules.every(rule => rule.title === "보존할 제목" && rule.generalText === "보존할 총평" && rule.personalityText === ""));
  assert.equal((await db.prisma.ruleVersion.findFirstOrThrow({ where: { status: "PUBLISHED" } })).id, "newer");
  assert.equal((await db.prisma.ruleVersion.findUniqueOrThrow({ where: { id: "older" } })).status, "ARCHIVED");
  assert.equal(await db.prisma.user.count(), 1);
  assert.deepEqual(await db.prisma.$queryRawUnsafe("PRAGMA foreign_key_check"), []);
  db.migrate();
  assert.equal(await db.prisma.interpretationRule.count(), 2);
});
