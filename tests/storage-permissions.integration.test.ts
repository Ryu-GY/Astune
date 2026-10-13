import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { testDatabase } from "./helpers/database";

const origin = "http://localhost:3471";
const input = { birthAtLocal: "1995-05-05T15:00:00", timezone: "Asia/Seoul", locationName: "Seoul",
  latitude: 37.5665, longitude: 126.978, maxMagnitude: 2 };
const astronomy = { selected_star: { id: 24608, display_name: "Capella", magnitude: 0.08 },
  selected_constellation: { code: "Aur", name_ko: "마차부자리", name_en: "Auriga" },
  metrics: { altitude_deg: 81.564, azimuth_deg: 170, zenith_distance_deg: 8.436 },
  astronomy_meta: { source_label: "integration fixture", catalog_version: "test", engine_name: "Skyfield",
    candidate_count: 31, calculated_at_utc: "1995-05-05T06:00:00Z" } };

test("T702: authenticated storage, ownership and rule publication through public route handlers", async t => {
  const db = testDatabase();
  const environment = { DATABASE_URL: db.databaseUrl, NODE_ENV: "production", ASTUNE_RULE_SOURCE: "database",
    ASTUNE_ALLOW_DEV_AUTH: "1", BETTER_AUTH_URL: origin, BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    GOOGLE_CLIENT_ID: "synthetic-test-client", GOOGLE_CLIENT_SECRET: "synthetic-test-secret" };
  const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  const { prisma } = await import("../src/lib/db/prisma");
  t.after(async () => {
    await prisma.$disconnect();
    await db.cleanup();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });
  const { getAuth } = await import("../src/lib/auth/server");
  const auth = getAuth();
  const cookieName = (await auth.$context).authCookies.sessionToken.name;
  // Seed synthetic sessions, then exercise the real Better Auth signature and DB lookup.
  // No provider login, mocked requireUser, or development-header authentication is used.
  async function session(userId: string, expiresAt = new Date(Date.now() + 3600_000)) {
    const token = randomBytes(32).toString("hex");
    const row = await db.prisma.session.create({ data: { token, userId, expiresAt } });
    const signature = createHmac("sha256", environment.BETTER_AUTH_SECRET).update(token).digest("base64");
    return { id: row.id, cookie: `${cookieName}=${encodeURIComponent(`${token}.${signature}`)}` };
  }
  const alice = await db.prisma.user.create({ data: { email: "alice@example.test", name: "Alice" } });
  const bob = await db.prisma.user.create({ data: { email: "bob@example.test", name: "Bob" } });
  const admin = await db.prisma.user.create({ data: { email: "admin@example.test", name: "Admin", role: "ADMIN" } });
  const aliceSession = await session(alice.id), bobSession = await session(bob.id), adminSession = await session(admin.id);
  const { seedDefaultRules } = await import("../prisma/seed-rules");
  await seedDefaultRules(db.prisma, admin.id);
  const locations = await import("../src/app/api/v1/locations/resolve/route");
  const previews = await import("../src/app/api/v1/readings/preview/route");
  const readings = await import("../src/app/api/v1/readings/route");
  const detail = await import("../src/app/api/v1/readings/[id]/route");
  const list = await import("../src/app/api/v1/me/readings/route");
  const profiles = await import("../src/app/api/v1/birth-profiles/route");
  const profileDetail = await import("../src/app/api/v1/birth-profiles/[id]/route");
  const versions = await import("../src/app/api/v1/admin/rule-versions/route");
  const rules = await import("../src/app/api/v1/admin/rule-versions/[id]/rules/route");
  const ruleById = await import("../src/app/api/v1/admin/rule-versions/[id]/rules/[ruleId]/route");
  const publish = await import("../src/app/api/v1/admin/rule-versions/[id]/publish/route");
  const audits = await import("../src/app/api/v1/admin/audit-logs/route");
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  let upstreamUnavailable = false;
  let upstreamCalls = 0;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    upstreamCalls++;
    if (upstreamUnavailable) throw new Error("synthetic astronomy outage");
    if (String(url).endsWith("/api/v1/locations/resolve")) return Response.json({ success: true, data: {
      items: [{ city_name: "Seoul", display_name: "Seoul, KR", country_code: "KR", ...input,
        source: "city_table", timezone_source: "city_table", attribution: null }], cache_hit: false, manual_input_hint: "직접 입력" } });
    assert(String(url).endsWith("/api/v1/readings/preview"), `Unexpected network call: ${url}`);
    return Response.json({ success: true, data: astronomy });
  });
  function request(path: string, method = "GET", body?: unknown, cookie?: string, headers: Record<string, string> = {}) {
    return new NextRequest(`${origin}/api/v1/${path}`, { method,
      headers: { "content-type": "application/json", origin, "x-request-id": "storage-integration",
        ...(cookie ? { cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  }
  async function response(pending: Promise<Response>, status = 200, code?: string) {
    const result = await pending;
    const body = await result.json();
    assert.equal(result.status, status, JSON.stringify(body));
    assert.equal(body.success, status < 400);
    assert.equal(result.headers.get("cache-control"), "no-store");
    assert.equal(body.meta.requestId, "storage-integration");
    assert.equal(result.headers.get("x-request-id"), body.meta.requestId);
    if (code) assert.equal(body.error.code, code);
    return body.data;
  }
  const save = (body: unknown = input, cookie = aliceSession.cookie) => response(readings.POST(request("readings", "POST", body, cookie)), 201);

  await t.test("location and preview are public and do not persist private data", async () => {
    const location = await response(locations.POST(request("locations/resolve", "POST", { query: "Seoul", limit: 1 })));
    assert.equal(location.candidates[0].timezone, "Asia/Seoul");
    const preview = await response(previews.POST(request("readings/preview", "POST", input)));
    assert.equal(preview.interpretation.sections.length, 5);
    assert.equal(preview.interpretation.scores.length, 4);
    assert.equal(await db.prisma.reading.count(), 0);
    assert.equal(await db.prisma.birthProfile.count(), 0);
  });

  await t.test("every private route rejects anonymous and forged development credentials", async () => {
    const spoof = { "x-user-id": admin.id, "x-user-role": "ADMIN" };
    const req = (path: string, method = "GET", body?: unknown) => request(path, method, body, undefined, spoof);
    for (const call of [
      () => readings.POST(req("readings", "POST", input)), () => list.GET(req("me/readings")),
      () => detail.GET(req("readings/missing"), params("missing")),
      () => profiles.POST(req("birth-profiles", "POST", input)), () => profiles.GET(req("birth-profiles")),
      () => profileDetail.GET(req("birth-profiles/missing"), params("missing")),
      () => versions.GET(req("admin/rule-versions")), () => versions.POST(req("admin/rule-versions", "POST", { name: "spoof" })),
      () => rules.POST(req("admin/rule-versions/missing/rules", "POST", {}), params("missing")),
      () => ruleById.PUT(req("admin/rule-versions/missing/rules/missing", "PUT", {}), { params: Promise.resolve({ id: "missing", ruleId: "missing" }) }),
      () => publish.POST(req("admin/rule-versions/missing/publish", "POST", {}), params("missing")),
      () => audits.GET(req("admin/audit-logs")),
    ]) await response(call(), 401, "AUTH_REQUIRED");
    assert.equal(await db.prisma.reading.count(), 0);
  });

  await t.test("tampered, expired, revoked and logged-out sessions cannot read private data", async () => {
    const expired = await session(alice.id, new Date(Date.now() - 1000));
    const revoked = await session(alice.id);
    await db.prisma.session.delete({ where: { id: revoked.id } });
    const tampered = `${cookieName}=${encodeURIComponent("forged.invalid-signature")}`;
    for (const cookie of [expired.cookie, revoked.cookie, tampered]) {
      await response(list.GET(request("me/readings", "GET", undefined, cookie)), 401, "AUTH_REQUIRED");
    }
    const signedOut = await session(alice.id);
    await auth.api.signOut({ headers: new Headers({ cookie: signedOut.cookie, origin }) });
    assert.equal(await db.prisma.session.count({ where: { id: signedOut.id } }), 0);
    await response(list.GET(request("me/readings", "GET", undefined, signedOut.cookie)), 401, "AUTH_REQUIRED");
  });

  await t.test("save, detail and paginated lists preserve input and restrict both readings and profiles to their owner", async () => {
    const saved = await save({ ...input, name: "Synthetic Alice", saveBirthProfile: true, profileLabel: "Seoul test",
      userId: bob.id, role: "ADMIN" });
    const row = await db.prisma.reading.findUniqueOrThrow({ where: { id: saved.readingId } });
    assert.equal(row.userId, alice.id);
    assert.equal(row.birthProfileId, saved.birthProfileId);
    assert.equal(JSON.parse(row.previewSnapshotJson!).interpretation.ruleVersionId, saved.preview.interpretation.ruleVersionId);
    const restored = await response(detail.GET(request(`readings/${row.id}`, "GET", undefined, aliceSession.cookie), params(row.id)));
    assert.deepEqual(restored.preview, saved.preview);
    for (const cookie of [bobSession.cookie, adminSession.cookie]) {
      await response(detail.GET(request(`readings/${row.id}`, "GET", undefined, cookie), params(row.id)), 404, "READING_NOT_FOUND");
      await response(readings.POST(request("readings", "POST", { birthProfileId: saved.birthProfileId }, cookie)), 404, "PROFILE_NOT_FOUND");
      const privateList = await response(list.GET(request("me/readings", "GET", undefined, cookie)));
      assert.equal(privateList.total, 0);
      assert.deepEqual(privateList.items, []);
      assert.equal((await response(profiles.GET(request("birth-profiles", "GET", undefined, cookie)))).total, 0);
    }
    const reused = await save({ birthProfileId: saved.birthProfileId });
    assert.deepEqual(reused.preview.input, saved.preview.input);
    const first = await response(list.GET(request("me/readings?pageSize=1&page=1", "GET", undefined, aliceSession.cookie)));
    const second = await response(list.GET(request("me/readings?pageSize=1&page=2", "GET", undefined, aliceSession.cookie)));
    assert.equal(first.total, 2);
    assert.equal(second.items.length, 1);
    assert.notEqual(first.items[0].id, second.items[0].id);
    assert(!("previewSnapshotJson" in first.items[0]));
    const ownProfiles = await response(profiles.GET(request("birth-profiles", "GET", undefined, aliceSession.cookie)));
    assert.equal(ownProfiles.items[0].id, saved.birthProfileId);
  });

  await t.test("account profiles save independently and expose exact reusable coordinates only to their owner", async () => {
    const before = await db.prisma.reading.count();
    const profileInput = { ...input, name: "Profile owner", birthAtLocal: "1995-05-05T15:00:30",
      latitude: 34.69379, longitude: 135.50107, timezone: "Asia/Tokyo", locationName: "오사카 시, 오사카 부, 일본",
      profileLabel: "나의 출생 정보", maxMagnitude: 3, userId: bob.id };
    const saved = await response(profiles.POST(request("birth-profiles", "POST", profileInput, aliceSession.cookie)), 201);
    assert.equal(await db.prisma.reading.count(), before, "saving a profile must not create a reading");
    const id = saved.birthProfile.id;
    const result = await response(profileDetail.GET(request(`birth-profiles/${id}`, "GET", undefined, aliceSession.cookie), params(id)));
    assert.equal(result.birthProfile.input.latitude, 34.69379);
    assert.equal(result.birthProfile.input.longitude, 135.50107);
    assert.equal(result.birthProfile.input.timezone, "Asia/Tokyo");
    assert.equal(result.birthProfile.input.birthAtLocal, "1995-05-05T15:00:30");
    assert.equal(result.birthProfile.input.maxMagnitude, 3);
    assert.equal(result.birthProfile.label, "나의 출생 정보");
    for (const cookie of [bobSession.cookie, adminSession.cookie]) {
      await response(profileDetail.GET(request(`birth-profiles/${id}`, "GET", undefined, cookie), params(id)), 404, "PROFILE_NOT_FOUND");
    }
    await response(profileDetail.GET(request("birth-profiles/missing", "GET", undefined, aliceSession.cookie), params("missing")), 404, "PROFILE_NOT_FOUND");
    const preview = await response(previews.POST(request("readings/preview", "POST", result.birthProfile.input)));
    assert.equal(preview.input.longitude, profileInput.longitude);
    assert.equal(preview.input.birthAtLocal, profileInput.birthAtLocal);
    assert.equal(await db.prisma.reading.count(), before, "using a profile for preview must not save a reading");
  });

  await t.test("invalid data, cross-origin requests and calculation failures leave no partial records", async () => {
    const before = { readings: await db.prisma.reading.count(), profiles: await db.prisma.birthProfile.count() };
    for (const body of [{ ...input, latitude: 91 }, { ...input, birthAtLocal: "2026-02-30T15:00" }, { birthProfileId: "missing" },
      { ...input, birthTimeUnknown: true, saveBirthProfile: true }]) {
      const code = "birthProfileId" in body ? "PROFILE_NOT_FOUND" : "VALIDATION_ERROR";
      await response(readings.POST(request("readings", "POST", body, aliceSession.cookie)), code === "PROFILE_NOT_FOUND" ? 404 : 400, code);
    }
    await response(readings.POST(request("readings", "POST", { ...input, timezone: "invalid/timezone" }, aliceSession.cookie)), 422, "TIMEZONE_NOT_FOUND");
    await response(list.GET(request("me/readings?page=0", "GET", undefined, aliceSession.cookie)), 400, "VALIDATION_ERROR");
    await response(profiles.GET(request("birth-profiles?pageSize=51", "GET", undefined, aliceSession.cookie)), 400, "VALIDATION_ERROR");
    const crossOriginHeaders: Record<string, string>[] = [{ origin: "https://untrusted.example" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of crossOriginHeaders) {
      await response(readings.POST(request("readings", "POST", input, aliceSession.cookie, headers)), 403, "ORIGIN_NOT_ALLOWED");
    }
    await response(readings.POST(request("readings", "POST", input, aliceSession.cookie, { "content-type": "text/plain" })), 415, "JSON_REQUIRED");
    upstreamUnavailable = true;
    try { await response(readings.POST(request("readings", "POST", { ...input, saveBirthProfile: true }, aliceSession.cookie)), 503, "ASTRO_SERVICE_UNAVAILABLE"); }
    finally { upstreamUnavailable = false; }
    assert.equal(await db.prisma.reading.count(), before.readings);
    assert.equal(await db.prisma.birthProfile.count(), before.profiles);
  });

  await t.test("unknown birth time stays marked after saving and restoring", async () => {
    const saved = await save({ ...input, birthAtLocal: "1995-05-05", birthTimeUnknown: true }, bobSession.cookie);
    assert.equal(saved.birthProfileId, null);
    const restored = await response(detail.GET(request(`readings/${saved.readingId}`, "GET", undefined, bobSession.cookie), params(saved.readingId)));
    assert.equal(restored.preview.input.birthAtLocal, "1995-05-05T12:00:00");
    assert.equal(restored.preview.input.birthTimeUnknown, true);
    assert.equal(restored.preview.calculationNotice.code, "BIRTH_TIME_UNKNOWN");
    assert.deepEqual(restored.preview, saved.preview);
  });

  await t.test("admin roles come from the database and role revocation is immediate", async () => {
    for (const call of [
      () => versions.GET(request("admin/rule-versions", "GET", undefined, aliceSession.cookie, { "x-user-role": "ADMIN" })),
      () => versions.POST(request("admin/rule-versions", "POST", { name: "unauthorized" }, aliceSession.cookie)),
      () => rules.POST(request("admin/rule-versions/missing/rules", "POST", {}, aliceSession.cookie), params("missing")),
      () => ruleById.PUT(request("admin/rule-versions/missing/rules/missing", "PUT", {}, aliceSession.cookie), { params: Promise.resolve({ id: "missing", ruleId: "missing" }) }),
      () => publish.POST(request("admin/rule-versions/missing/publish", "POST", {}, aliceSession.cookie), params("missing")),
      () => audits.GET(request("admin/audit-logs", "GET", undefined, aliceSession.cookie)),
    ]) await response(call(), 403, "ADMIN_REQUIRED");
    await response(versions.GET(request("admin/rule-versions", "GET", undefined, adminSession.cookie)));
    await db.prisma.user.update({ where: { id: admin.id }, data: { role: "USER" } });
    try { await response(versions.GET(request("admin/rule-versions", "GET", undefined, adminSession.cookie)), 403, "ADMIN_REQUIRED"); }
    finally { await db.prisma.user.update({ where: { id: admin.id }, data: { role: "ADMIN" } }); }
  });

  await t.test("malformed administrator inputs fail as client errors without creating a version", async () => {
    const before = await db.prisma.ruleVersion.count();
    for (const body of [null, {}, { name: 123 }, { name: [] }, { name: " " }, { name: "valid", description: {} }]) {
      await response(versions.POST(request("admin/rule-versions", "POST", body, adminSession.cookie)), 400);
    }
    assert.equal(await db.prisma.ruleVersion.count(), before);
  });

  await t.test("publishing changes new previews while saved interpretations stay immutable", async () => {
    const saved = await save();
    const previousVersion = saved.preview.interpretation.ruleVersionId;
    const draft = await response(versions.POST(request("admin/rule-versions", "POST", { name: `Integration ${randomUUID()}` }, adminSession.cookie)), 201);
    const id = draft.ruleVersion.id;
    await response(publish.POST(request(`admin/rule-versions/${id}/publish`, "POST", {}, adminSession.cookie), params(id)), 400, "INVALID_RULE_INPUT");
    assert.equal((await db.prisma.ruleVersion.findFirstOrThrow({ where: { status: "PUBLISHED" } })).id, previousVersion);
    await response(rules.POST(request(`admin/rule-versions/${id}/rules`, "POST", { title: "Invalid", scopeType: "star" }, adminSession.cookie), params(id)), 400, "VALIDATION_ERROR");
    const replacement = { title: "Replacement", scopeType: "global", templates: { overview: "새 게시 규칙의 총평입니다.", personality: "새 성향 해석입니다.", love: "새 관계 해석입니다.", career: "새 일 해석입니다.", money: "새 재물 해석입니다." } };
    const createdRule = await response(rules.POST(request(`admin/rule-versions/${id}/rules`, "POST", replacement, adminSession.cookie), params(id)), 201);
    const updatedRule = await response(ruleById.PUT(request(`admin/rule-versions/${id}/rules/${createdRule.rule.id}`, "PUT",
      { ...replacement, title: "Revised replacement" }, adminSession.cookie), { params: Promise.resolve({ id, ruleId: createdRule.rule.id }) }));
    assert.equal(updatedRule.rule.id, createdRule.rule.id);
    assert.equal(updatedRule.rule.title, "Revised replacement");
    assert.equal(await db.prisma.interpretationRule.count({ where: { ruleVersionId: id } }), 1);
    const draftPreview = await response(previews.POST(request("readings/preview", "POST", input)));
    assert.equal(draftPreview.interpretation.ruleVersionId, previousVersion);
    await response(publish.POST(request(`admin/rule-versions/${id}/publish`, "POST", {}, adminSession.cookie), params(id)));
    assert.equal(await db.prisma.ruleVersion.count({ where: { status: "PUBLISHED" } }), 1);
    assert.equal((await db.prisma.ruleVersion.findUniqueOrThrow({ where: { id: previousVersion } })).status, "ARCHIVED");
    const updated = await response(previews.POST(request("readings/preview", "POST", input)));
    assert.equal(updated.interpretation.ruleVersionId, id);
    assert.equal(updated.interpretation.summary, replacement.templates.overview);
    const callsBeforeRead = upstreamCalls;
    const original = await response(detail.GET(request(`readings/${saved.readingId}`, "GET", undefined, aliceSession.cookie), params(saved.readingId)));
    assert.deepEqual(original.preview, saved.preview);
    assert.equal(upstreamCalls, callsBeforeRead, "Reading a saved snapshot must not recalculate astronomy");
    await response(rules.POST(request(`admin/rule-versions/${id}/rules`, "POST", replacement, adminSession.cookie), params(id)), 409, "RULE_VERSION_NOT_DRAFT");
    const log = await response(audits.GET(request("admin/audit-logs?pageSize=50", "GET", undefined, adminSession.cookie)));
    assert(log.items.some((item: { action: string; targetId: string }) => item.action === "RULE_VERSION_PUBLISHED" && item.targetId === id));
  });
});
