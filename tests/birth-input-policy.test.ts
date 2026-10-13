import { test } from "node:test";
import assert from "node:assert/strict";
import { DateTime } from "luxon";
import { birthDateIssue } from "../src/lib/validation/birth-date-policy";
import { createReadingSchema, previewReadingInputSchema } from "../src/lib/validation/reading";
import { normalizePreviewInput } from "../src/server/services/preview-service";
import { toApiErrorResponse } from "../src/lib/errors/to-api-error";
import { testDatabase } from "./helpers/database";

const base = { birthAtLocal:"1995-05-05T15:00:00", timezone:"Asia/Seoul", latitude:37.5665, longitude:126.978, locationName:"Seoul" };

test("T603: future-date policy uses the birthplace calendar date and accepts today's noon reference", () => {
  const now = DateTime.fromISO("2026-10-13T00:30:00Z");
  assert.equal(birthDateIssue("2026-10-13", "Asia/Seoul", now), undefined);
  assert.equal(birthDateIssue("2026-10-13", "America/Los_Angeles", now), "BIRTH_DATE_IN_FUTURE");
  assert.equal(birthDateIssue("2026-10-14", "Asia/Seoul", now), "BIRTH_DATE_IN_FUTURE");
  assert.equal(birthDateIssue("1995-05-05", "UTC+9", now), "TIMEZONE_NOT_FOUND");
  const today = DateTime.now().setZone("Asia/Seoul").toISODate()!;
  assert.equal(previewReadingInputSchema.parse({...base, birthAtLocal:today,birthTimeUnknown:true}).birthAtLocal, today+"T12:00:00");
});

test("T603: preview, split preview and save schemas agree on dates, offsets, timezone and numeric inputs", async () => {
  const cases = [
    [{birthAtLocal:"2024-02-30T12:00:00"}, "VALIDATION_ERROR", 400],
    [{birthAtLocal:"1995-05-05T15:00:00+09:00"}, "VALIDATION_ERROR", 400],
    [{birthAtLocal:"2099-01-01T12:00:00"}, "BIRTH_DATE_IN_FUTURE", 422],
    [{timezone:"UTC+09"}, "TIMEZONE_NOT_FOUND", 422],
    [{latitude:"37.5"}, "VALIDATION_ERROR", 400],
    [{longitude:181}, "VALIDATION_ERROR", 400],
    [{dstFold:true}, "VALIDATION_ERROR", 400],
  ] as const;
  for (const [patch, code, status] of cases) {
    const input = {...base, ...patch};
    const [birthDate, birthTimeLocal] = input.birthAtLocal.split("T");
    for (const parse of [() => previewReadingInputSchema.parse(input), () => createReadingSchema.parse(input),
      () => normalizePreviewInput({...input,birthDate,birthTimeLocal})]) {
      try { parse(); assert.fail("must reject invalid birth input"); }
      catch (error) {
        const response = toApiErrorResponse(error);
        assert.equal(response.status, status);
        assert.equal((await response.json()).error.code, code);
      }
    }
  }
});

test("T603: save and profile paths reject invalid input and core DST/range failures before database writes", async t => {
  const db = testDatabase();
  const old = process.env.DATABASE_URL;
  process.env.DATABASE_URL = db.databaseUrl;
  const { prisma } = await import("../src/lib/db/prisma");
  const { createReading, createBirthProfile } = await import("../src/server/services/reading-service");
  t.after(async () => {
    await prisma.$disconnect(); await db.cleanup();
    if (old === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = old;
  });
  const user = await db.prisma.user.create({data:{email:"birth-policy@example.test",name:"Test"}});
  let calls = 0, errorCode = "LOCAL_TIME_AMBIGUOUS";
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({error:{code:errorCode,message:"upstream fixture"}}, {status:422});
  });
  for (const action of [createReading, createBirthProfile]) {
    for (const patch of [{birthAtLocal:"2099-01-01T12:00:00"}, {birthAtLocal:"1995-05-05T15:00:00Z"}, {latitude:91}, {timezone:"UTC+9"}]) {
      await assert.rejects(action({...base,...patch}, {userId:user.id}));
    }
    assert.equal(calls, action === createReading ? 0 : 4);
    for (const code of ["LOCAL_TIME_AMBIGUOUS","LOCAL_TIME_NONEXISTENT","EPHEMERIS_OUT_OF_RANGE","ASTRO_SERVICE_UNAVAILABLE"]) {
      errorCode = code;
      await assert.rejects(action({...base,saveBirthProfile:action===createReading}, {userId:user.id}), {code});
    }
  }
  assert.equal(await db.prisma.birthProfile.count(), 0);
  assert.equal(await db.prisma.reading.count(), 0);
});
