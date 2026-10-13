import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import policies from "../data/contracts/error-policy.json";
import { AppError } from "../src/lib/errors/app-error";
import { handleApiRequest, ok } from "../src/lib/utils/http";
import { getRequestId, recordCalculation, traceStage, upstreamHeaders } from "../src/lib/utils/request-context";
import { requestRepresentativeStar } from "../src/lib/astronomy/core-client";
import { POST } from "../src/app/api/v1/readings/preview/route";

const request = (id: string, path = "readings/preview") => new NextRequest(`http://localhost/api/v1/${path}?name=PRIVATE_QUERY`, {
  method: "POST", headers: { "x-request-id": id, cookie: "PRIVATE_COOKIE" },
});

test("T601: all error policies override inconsistent statuses and omit private details", async t => {
  t.mock.method(console, "info", () => {});
  for (const [code, policy] of Object.entries(policies)) {
    const response = await handleApiRequest(request("policy-test"), async () => {
      throw new AppError("PRIVATE_MESSAGE", { code, statusCode: 418,
        details: { birthAtLocal: "PRIVATE_BIRTH", latitude: 12.3456, path: "PRIVATE_PATH", available_folds: [0, 1] } });
    });
    const body = await response.json();
    assert.equal(response.status, policy.status, code);
    assert.equal(body.error.code, code);
    assert.equal(body.error.category, policy.category);
    assert.equal(body.error.recovery, policy.recovery);
    assert.deepEqual(body.error.details, { availableFolds: [0, 1] });
    assert(!JSON.stringify(body).includes("PRIVATE"));
    assert.equal(response.headers.get("x-request-id"), body.meta.requestId);
    assert.match(response.headers.get("server-timing")!, /total;dur=\d/);
  }
});

test("T601: malformed request JSON is 400, internal parsing failure is 500", async t => {
  t.mock.method(console, "info", () => {});
  const invalid = await POST(new NextRequest("http://localhost/api/v1/readings/preview", { method: "POST", body: "{" }));
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
  const failure = await handleApiRequest(request("syntax-test"), async () => { throw new SyntaxError("PRIVATE_DATABASE_VALUE"); });
  assert.equal(failure.status, 500);
  assert.equal((await failure.json()).error.code, "INTERNAL_SERVER_ERROR");
});

test("T601: calculation 500 and validation 400 are preserved across upstream; unknown errors become 502", async () => {
  const input = { birthAtLocal: "1995-05-05T15:00:00", timezone: "Asia/Seoul", latitude: 37.5, longitude: 127 };
  for (const [code, status] of [["CALCULATION_FAILED", 500], ["VALIDATION_ERROR", 400], ["UNKNOWN_PRIVATE", 502]] as const) {
    const fetcher: typeof fetch = async () => Response.json({error:{code,message:"PRIVATE",details:{input:"PRIVATE"}}}, {status:500});
    await assert.rejects(requestRepresentativeStar(input, fetcher), (error: AppError) => {
      assert.equal(error.statusCode, status);
      assert.equal(error.code, code === "UNKNOWN_PRIVATE" ? "ASTRO_INVALID_RESPONSE" : code);
      assert(!JSON.stringify(error).includes("PRIVATE"));
      return true;
    });
  }
});

test("T602: concurrent traces isolate IDs, retain timings on failures and log only allowed metadata", async t => {
  const entries: Record<string, unknown>[] = [];
  t.mock.method(console, "info", (line: string) => entries.push(JSON.parse(line)));
  t.mock.method(console, "error", () => { assert.fail("raw exception logging is forbidden"); });
  await Promise.all(["trace-a", "trace-b"].map((id, index) => handleApiRequest(request(id, "readings/PRIVATE_RECORD_ID"), async () => {
    await traceStage("astronomy", async () => {
      await new Promise(resolve => setTimeout(resolve, index ? 2 : 10));
      assert.equal(getRequestId(), id);
      assert.equal(upstreamHeaders()["X-Request-ID"], id);
      if (index) throw new Error("PRIVATE_BIRTH, PRIVATE_COORDINATES, PRIVATE_TOKEN");
    });
    recordCalculation({engineName:"Skyfield",catalogVersion:"test-v1",candidateCount:42});
    return ok({value:1});
  })));
  assert.equal(getRequestId(), undefined);
  assert.equal(entries.length, 2);
  assert(!JSON.stringify(entries).includes("PRIVATE"));
  const success = entries.find(entry => entry.requestId === "trace-a")!;
  const failed = entries.find(entry => entry.requestId === "trace-b")!;
  assert.equal(success.route, "/api/v1/readings/[id]");
  assert.equal(success.status, 200);
  assert.deepEqual(success.calculation, {engineName:"Skyfield",catalogVersion:"test-v1",candidateCount:42});
  assert.equal(failed.status, 500);
  assert.equal(failed.errorCode, "INTERNAL_SERVER_ERROR");
  for (const entry of entries) {
    assert(Number(entry.durationMs) >= 0);
    assert(Number((entry.stages as Record<string, number>).astronomy) >= 0);
    assert.deepEqual(Object.keys(entry).filter(key => !["event","service","requestId","route","method","status","durationMs","stages","errorCode","calculation"].includes(key)), []);
  }
});
