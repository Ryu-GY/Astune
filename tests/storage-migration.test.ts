import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { testDatabase } from "./helpers/database";
import { decode, encode, exportDatabase, importDatabase, modelOrder } from "../src/lib/db/transfer";
import { seedDefaultRules } from "../prisma/seed-rules";
import { createRuleVersion, createInterpretationRule } from "../src/server/services/admin-service";
import { DEFAULT_INTERPRETATION_RULES } from "../src/lib/readings/fixtures/default-rules";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
test("T401 SQLite backup round-trip preserves all rows, refuses overwrite and rolls back failed imports", async t => {
  const source = testDatabase(), target = testDatabase(), brokenTarget = testDatabase();
  t.after(async () => { await source.cleanup(); await target.cleanup(); await brokenTarget.cleanup(); });
  const user = await source.prisma.user.create({ data: { email: "migration@example.test", name: "보존할 사용자", role: "ADMIN", emailVerified: true } });
  await seedDefaultRules(source.prisma, user.id);
  await source.prisma.birthProfile.create({ data: { userId: user.id, label: "DST 프로필", birthAtLocal: "2020-11-01T01:30:00", timezone: "America/New_York", latitude: 40.7, longitude: -74, dstFold: 1, maxMagnitude: 5.5 } });
  await source.prisma.account.create({ data: { accountId: "synthetic-google-id", providerId: "google", userId: user.id } });
  await source.prisma.session.create({ data: { userId: user.id, token: "synthetic-session", expiresAt: new Date("2030-01-01Z") } });
  await source.prisma.rateLimit.create({ data: { key: "synthetic", count: 2, lastRequest: 1791860938123n } });
  const original = await exportDatabase(source.prisma);
  await importDatabase(target.prisma, original);
  assert.deepEqual((await exportDatabase(target.prisma)).tables, original.tables);
  await assert.rejects(importDatabase(target.prisma, original), /Destination must be empty/);
  await seedDefaultRules(target.prisma, user.id);
  assert.equal(await target.prisma.interpretationRule.count(), DEFAULT_INTERPRETATION_RULES.length);
  assert.equal(await target.prisma.ruleVersion.count({ where: { status: "PUBLISHED" } }), 1);
  const corrupt = structuredClone(original);
  (corrupt.tables.birthProfile as { userId: string }[])[0].userId = "missing-owner";
  corrupt.checksum = hash(corrupt.tables);
  await assert.rejects(importDatabase(brokenTarget.prisma, corrupt));
  assert.equal(await brokenTarget.prisma.user.count(), 0, "all earlier inserts must roll back");
  corrupt.checksum = "invalid";
  await assert.rejects(importDatabase(brokenTarget.prisma, corrupt), /corrupted/);
});

test("T401 PostgreSQL migration rollback, seed transfer, constraints and export fidelity on PostgreSQL WASM", async t => {
  const source = testDatabase(); t.after(() => source.cleanup());
  const user = await source.prisma.user.create({ data: { email: "pg@example.test", role: "ADMIN" } });
  await seedDefaultRules(source.prisma, user.id);
  await source.prisma.birthProfile.create({ data: { userId: user.id, label: "fold", birthAtLocal: "2020-11-01T01:30:00", timezone: "America/New_York", latitude: 40, longitude: -74, dstFold: 0, maxMagnitude: 5.5 } });
  const snapshot = await exportDatabase(source.prisma);
  const sql = readFileSync("prisma/postgresql/migrations/20261013000000_initial/migration.sql", "utf8");
  const pg = new PGlite(); t.after(() => pg.close());
  await pg.exec(`BEGIN; ${sql} ROLLBACK;`);
  assert.equal((await pg.query<{ count: number }>("SELECT count(*)::int as count FROM information_schema.tables WHERE table_schema='public'")).rows[0].count, 0);
  await pg.exec(sql);
  for (const model of modelOrder) {
    const table = model[0].toUpperCase() + model.slice(1);
    for (const row of decode(snapshot.tables[model]) as Record<string, unknown>[]) {
      const keys = Object.keys(row);
      await pg.query(`INSERT INTO "${table}" (${keys.map(key => `"${key}"`).join(",")}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(",")})`, Object.values(row));
    }
    const rows = (await pg.query(`SELECT * FROM "${table}" ORDER BY id`)).rows;
    const expected = decode(snapshot.tables[model]) as Record<string, unknown>[];
    // JSON columns and IDs remain exact; timestamp precision is checked independently.
    assert.deepEqual(JSON.parse(JSON.stringify(encode(rows))), JSON.parse(JSON.stringify(encode(expected))), table);
  }
  await assert.rejects(pg.query(`UPDATE "BirthProfile" SET "dstFold"=2`));
  await assert.rejects(pg.query(`UPDATE "InterpretationRule" SET "priority"=32768`));
  await assert.rejects(pg.query(`UPDATE "InterpretationRule" SET "starId"=1 WHERE "scopeType"='global'`));
  await assert.rejects(pg.query(`INSERT INTO "RuleVersion" (id,name,status,"createdById","updatedAt") VALUES ('duplicate','duplicate','PUBLISHED',$1,NOW())`, [user.id]));
  const schema = readFileSync("prisma/schema.prisma", "utf8").replace('provider = "sqlite"', 'provider = "postgresql"')
    .replace(/^(\s+\w+\s+DateTime\??[^\r\n]*)/gm, "$1 @db.Timestamptz(3)");
  assert.equal(readFileSync("prisma/postgresql/schema.prisma", "utf8"), schema);
});

test("T503-T504 upsert records before and after atomically and prevents moving a rule between versions", async t => {
  const db = testDatabase(); t.after(() => db.cleanup());
  const admin = await db.prisma.user.create({ data: { email: "audit@example.test", role: "ADMIN" } });
  const first = await createRuleVersion({ name: "Draft", createdById: admin.id }, db.prisma);
  const command = { id: "stable-rule", ruleVersionId: first.ruleVersion.id, adminUserId: admin.id, scopeType: "global" as const, title: "Global", templates: { overview: "원래 해석" } };
  await createInterpretationRule(command, db.prisma);
  await createInterpretationRule({ ...command, templates: { overview: "수정한 해석" } }, db.prisma);
  assert.equal(await db.prisma.interpretationRule.count(), 1);
  const log = await db.prisma.adminAuditLog.findFirstOrThrow({ where: { action: "RULE_UPDATED" } });
  const change = JSON.parse(log.payloadJson!);
  assert.equal(change.before.generalText, "원래 해석"); assert.equal(change.after.generalText, "수정한 해석");
  const second = await createRuleVersion({ name: "Other", createdById: admin.id }, db.prisma);
  await assert.rejects(createInterpretationRule({ ...command, ruleVersionId: second.ruleVersion.id }, db.prisma), { code: "RULE_VERSION_MISMATCH" });
  await assert.rejects(createInterpretationRule({ ...command, adminUserId: "invalid-actor", templates: { overview: "이 내용은 롤백" } }, db.prisma));
  assert.equal((await db.prisma.interpretationRule.findUniqueOrThrow({ where: { id: command.id } })).generalText, "수정한 해석");
  await assert.rejects(createRuleVersion({ name: "Rollback", createdById: "missing-user" }, db.prisma));
  assert.equal(await db.prisma.ruleVersion.count(), 2);
});

test("detailed builtin sections provide three paragraphs with no unresolved variables after rendering", async () => {
  const { RuleBasedInterpretationEngine } = await import("../src/lib/readings/interpreter");
  const { DEFAULT_RULE_VERSION } = await import("../src/lib/readings/fixtures/default-rules");
  for (const code of [...DEFAULT_INTERPRETATION_RULES.filter(rule => rule.scopeType === "constellation").map(rule => rule.constellationCode!), "Oct"]) {
    const result = new RuleBasedInterpretationEngine().interpret({ version: DEFAULT_RULE_VERSION, rules: DEFAULT_INTERPRETATION_RULES, astro: {
      selectedStar: { id: 24608, displayName: "Capella", magnitude: 0.08 }, selectedConstellation: { code, nameKo: code },
      metrics: { altitudeDeg: 81.564, azimuthDeg: 170, zenithDistanceDeg: 8.436 },
    } });
    assert.equal(result.sections.length, 5);
    for (const section of result.sections) { assert(section.content.length >= 400, `${code}/${section.type}`); assert.equal(section.content.split(/\n\s*\n/).length, 3); assert(!/[{}]/.test(section.content)); }
  }
});
