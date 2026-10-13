import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { testDatabase } from "./helpers/database";
import { seedDefaultRules } from "../prisma/seed-rules";

test("Next preview route returns the same structured builtin and DB reading and missing-version errors", async t => {
  const db = testDatabase();
  const previous = { database: process.env.DATABASE_URL, source: process.env.ASTUNE_RULE_SOURCE };
  process.env.DATABASE_URL = db.databaseUrl;
  const { prisma } = await import("../src/lib/db/prisma");
  t.after(async () => {
    await prisma.$disconnect();
    await db.cleanup();
    if (previous.database === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.database;
    if (previous.source === undefined) delete process.env.ASTUNE_RULE_SOURCE;
    else process.env.ASTUNE_RULE_SOURCE = previous.source;
  });
  const admin = await db.prisma.user.create({ data: { email: "preview-route@astune.local" } });
  await seedDefaultRules(db.prisma, admin.id);
  t.mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: {
    selected_star: { id: 24608, display_name: "Capella", magnitude: 0.08 },
    selected_constellation: { code: "Aur", name_ko: "마차부자리", name_en: "Auriga" },
    metrics: { altitude_deg: 81.564, azimuth_deg: 170, zenith_distance_deg: 8.436 },
    astronomy_meta: { source_label: "fixture", catalog_version: "test", engine_name: "Skyfield", candidate_count: 31, calculated_at_utc: "1995-05-05T06:00:00Z" }
  } }));
  const { POST } = await import("../src/app/api/v1/readings/preview/route");
  const request = () => new NextRequest("http://localhost/api/v1/readings/preview", {
    method: "POST", headers: { "content-type": "application/json", "x-request-id": "preview-contract-test" },
    body: JSON.stringify({ birthAtLocal: "1995-05-05T15:00:00", timezone: "Asia/Seoul", latitude: 37.5665, longitude: 126.978 })
  });
  process.env.ASTUNE_RULE_SOURCE = "builtin";
  const builtin = await POST(request());
  const builtinBody = await builtin.json();
  assert.equal(builtin.status, 200);
  process.env.ASTUNE_RULE_SOURCE = "database";
  const database = await POST(request());
  const envelope = await database.json();
  const body = envelope.data;
  assert.equal(database.status, 200);
  assert.deepEqual(envelope, builtinBody);
  assert.equal(envelope.success, true);
  assert.equal(envelope.meta.requestId, "preview-contract-test");
  assert.equal(database.headers.get("x-request-id"), envelope.meta.requestId);
  assert.equal(body.ok, undefined);
  assert.deepEqual(body.interpretation.sections.map((section: { type: string }) => section.type), ["overview", "personality", "love", "career", "money"]);
  assert.equal(body.interpretation.scores.length, 4);
  assert(body.interpretation.sections.every((section: { content: string }) => section.content.length > 20 && !/[{}]/.test(section.content)));
  assert(body.interpretation.matchedRuleIds.includes("ir_star_24608_v3"));
  assert(body.interpretation.sections.every((s: { sourceScope: string }) => s.sourceScope === "star"));
  assert.equal(body.reading.love, body.interpretation.sections[2].content);
  assert.equal(body.reading.career, body.interpretation.sections[3].content);
  assert.equal(body.reading.money, body.interpretation.sections[4].content);
  await db.prisma.ruleVersion.updateMany({ where: { status: "PUBLISHED" }, data: { status: "ARCHIVED" } });
  const missing = await POST(request());
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error.code, "RULE_VERSION_NOT_FOUND");
});
