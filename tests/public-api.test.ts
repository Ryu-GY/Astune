import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/v1/locations/resolve/route";
import { handleApiRequest, ok } from "../src/lib/utils/http";
import { requestRepresentativeStar } from "../src/lib/astronomy/core-client";

const candidate = { city_name: "Seoul", display_name: "Seoul, KR", country_code: "KR", latitude: 37.5665, longitude: 126.978, timezone: "Asia/Seoul", source: "city_table", timezone_source: "city_table", attribution: null };
const request = (body: unknown, id = "location-test") => new NextRequest("http://localhost/api/v1/locations/resolve", {
  method: "POST", headers: { "content-type": "application/json", "x-request-id": id }, body: JSON.stringify(body)
});

test("public location POST accepts canonical city, country and limit and returns candidates with provenance", async t => {
  let upstream: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    upstream = JSON.parse(String(options.body));
    assert.equal(new Headers(options.headers).get("x-request-id"), "location-test");
    return Response.json({ success: true, data: { items: [candidate, candidate], cache_hit: true, manual_input_hint: "좌표·시간대를 직접 입력해 주세요." } });
  });
  const response = await POST(request({query:"서울",countryCode:"kr",limit:1}));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.meta.requestId, response.headers.get("x-request-id"));
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.data.candidates.length, 1);
  assert.equal(body.data.candidates[0].timezone, "Asia/Seoul");
  assert.equal(body.data.candidates[0].countryCode, "KR");
  assert.equal(body.data.candidates[0].source, "city_table");
  assert.deepEqual(upstream, { query:"서울", country_code:"KR", limit:1, allow_external:false });
});

test("coordinates, manual timezone, empty candidates and GET compatibility use the same envelope", async t => {
  t.mock.method(globalThis, "fetch", async (_url: unknown, options: RequestInit) => {
    const sent = JSON.parse(String(options.body));
    return Response.json({ success:true, data:{
      items: sent.latitude === 0 ? [{...candidate, city_name:null,display_name:null,country_code:null,source:"coordinates",latitude:0,longitude:-140,timezone:"Etc/GMT+9",timezone_source:"manual"}] : [],
      cache_hit:false, manual_input_hint:"위도·경도와 IANA 시간대를 직접 입력해 주세요."
    } });
  });
  const coords = await (await POST(request({latitude:0,longitude:-140,timezone:"Etc/GMT+9"}))).json();
  assert.equal(coords.data.candidates[0].timezoneSource, "manual");
  assert.equal(coords.data.candidates[0].displayName, "Coordinates");
  const empty = await (await POST(request({query:"Unknown City"}))).json();
  assert.deepEqual(empty.data.candidates, []);
  assert.match(empty.data.manualInputHint, /직접 입력/);
  const legacy = await (await GET(new NextRequest("http://localhost/api/v1/locations/resolve?q=Unknown"))).json();
  assert.equal(legacy.success, true);
  assert.deepEqual(legacy.data.candidates, []);
});

test("invalid JSON and location values fail before upstream and have consistent errors and request IDs", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("must not call upstream"); });
  const invalid = [{}, {latitude:1}, {query:"서울",countryCode:"KOR"}, {query:"서울",limit:11}, {query:"서울",limit:"3"}];
  const requests = invalid.map(body => request(body));
  requests.push(new NextRequest("http://localhost/api/v1/locations/resolve", {method:"POST",body:"{",headers:{"x-request-id":"bad id"}}));
  for (const value of requests) {
    const response = await POST(value);
    const body = await response.json();
    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert("details" in body.error);
    assert.equal(body.meta.requestId, response.headers.get("x-request-id"));
    assert.match(body.meta.requestId, /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
  }
});

test("upstream timezone failures, rate limits, offline and malformed responses preserve public contract", async t => {
  let mode = 422;
  t.mock.method(globalThis, "fetch", async () => {
    if (mode === 503) throw new Error("offline");
    if (mode === 502) return new Response("not json");
    return Response.json({success:false,error:{code:mode === 429 ? "GEOCODER_RATE_LIMITED" : "TIMEZONE_REQUIRED",message:"직접 입력해 주세요.",details:{manualInput:true}}}, {status:mode});
  });
  for (const status of [422,429,503,502]) {
    mode = status;
    const response = await POST(request({latitude:0,longitude:-140}));
    const body = await response.json();
    assert.equal(response.status, status);
    assert.equal(body.success, false);
    assert.equal(body.meta.requestId, "location-test");
    assert.equal(body.error.code, {422:"TIMEZONE_REQUIRED",429:"GEOCODER_RATE_LIMITED",503:"LOCATION_SERVICE_UNAVAILABLE",502:"LOCATION_INVALID_RESPONSE"}[status]);
  }
});

test("concurrent preview requests forward their own request ID without context leaking", async () => {
  const input = {birthAtLocal:"1995-05-05T15:00:00",timezone:"Asia/Seoul",latitude:37.5665,longitude:126.978};
  const responses = await Promise.all(["request-a", "request-b"].map(id => handleApiRequest(request({}, id), async () => {
    const fetcher: typeof fetch = async (_url, options) => {
      await new Promise(resolve => setTimeout(resolve, id === "request-a" ? 15 : 1));
      assert.equal(new Headers(options?.headers).get("x-request-id"), id);
      return Response.json({error:{code:"LOCAL_TIME_AMBIGUOUS",message:"fold 선택"}}, {status:422});
    };
    return ok(await requestRepresentativeStar(input, fetcher));
  })));
  for (const [index, response] of responses.entries()) {
    const body = await response.json();
    assert.equal(body.meta.requestId, index === 0 ? "request-a" : "request-b");
    assert.equal(body.error.code, "LOCAL_TIME_AMBIGUOUS");
  }
});
