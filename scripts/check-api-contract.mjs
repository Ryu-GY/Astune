// Exercise the documented public and internal contracts using synthetic input.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, "").split("=")));
const next = options.next || "http://127.0.0.1:3000";
const python = options.python || "http://127.0.0.1:8000";
let checked = 0;
async function post(origin, path, payload, status = 200) {
  const requestId = `contract-${randomUUID()}`;
  const response = await fetch(`${origin}/api/v1/${path}`, {
    method: "POST", headers: {"content-type":"application/json", "x-request-id":requestId},
    body: JSON.stringify(payload), signal: AbortSignal.timeout(30000)
  });
  const body = await response.json();
  assert.equal(response.status, status, JSON.stringify(body));
  assert.equal(response.headers.get("x-request-id"), requestId);
  assert.equal(body.success, status === 200);
  if (origin === next) assert.equal(body.meta.requestId, requestId);
  else if (status !== 200) assert.equal(body.error.request_id, requestId);
  checked++;
  return body;
}

const location = await post(next, "locations/resolve", {query:"서울",countryCode:"KR",limit:1});
assert.equal(location.data.candidates.length, 1);
assert.equal(location.data.candidates[0].timezone, "Asia/Seoul");
assert.equal((await post(next, "locations/resolve", {latitude:40.7128,longitude:-74.006})).data.candidates[0].timezone, "America/New_York");
const empty = await post(next, "locations/resolve", {query:"NotARealCity123"});
assert.deepEqual(empty.data.candidates, []);
assert.match(empty.data.manualInputHint, /직접 입력/);
assert.equal((await post(next, "locations/resolve", {latitude:0,longitude:-140}, 422)).error.code, "TIMEZONE_REQUIRED");
assert.equal((await post(next, "locations/resolve", {latitude:0,longitude:-140,timezone:"Etc/GMT+9"})).data.candidates[0].timezone, "Etc/GMT+9");
assert.equal((await post(next, "locations/resolve", {query:"서울",limit:11}, 400)).error.code, "VALIDATION_ERROR");

const input = {birthAtLocal:"1995-05-05T15:00:00",timezone:"Asia/Seoul",latitude:37.5665,longitude:126.978,maxMagnitude:2};
const preview = await post(next, "readings/preview", input);
assert.equal(preview.data.zenithStar.hipId, 24608);
assert.equal(preview.data.interpretation.sections.length, 5);
assert.equal(preview.data.interpretation.scores.length, 4);
assert(preview.data.interpretation.matchedRuleIds.includes("ir_constellation_aur"));
assert(preview.data.interpretation.sections.every(section => section.content && !/[{}]/.test(section.content)));
assert.equal(preview.data.interpretation.readingId, undefined);
const dst = {...input,birthAtLocal:"2021-11-07T01:30:00",timezone:"America/New_York",latitude:40.7128,longitude:-74.006};
assert.equal((await post(next, "readings/preview", dst, 422)).error.code, "LOCAL_TIME_AMBIGUOUS");
await post(next, "readings/preview", {...dst,dstFold:1});
assert.equal((await post(next, "readings/preview", {...dst,birthAtLocal:"2021-03-14T02:30:00"}, 422)).error.code, "LOCAL_TIME_NONEXISTENT");
const internal = await post(python, "readings/preview", {birth_date:"1995-05-05",birth_time_local:"15:00:00",latitude:input.latitude,longitude:input.longitude,timezone:input.timezone});
assert.equal(internal.data.selected_star.id, preview.data.zenithStar.hipId);
assert.equal(internal.data.sections, undefined);
assert.equal((await post(python, "locations/resolve", {query:"서울",limit:1})).data.items[0].timezone, "Asia/Seoul");
assert.equal((await post(python, "locations/resolve", {query:"서울",limit:11}, 422)).error.code, "VALIDATION_ERROR");
const openapi = await (await fetch(`${python}/openapi.json`)).json();
assert(openapi.paths["/api/v1/readings/preview"].post.responses["422"].content["application/json"].schema.$ref.endsWith("/ErrorResponse"));
console.log(`PASS: ${checked} real HTTP cases, public/internal envelopes, request IDs, OpenAPI, locations, DST and interpretation.`);
