import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const options = Object.fromEntries(process.argv.slice(2).map(value => value.replace(/^--/, "").split("=")));
const next = options.next || "http://127.0.0.1:3000";
const python = options.python || "http://127.0.0.1:8000";
const base = {birthAtLocal:"1995-05-05T15:00:00",timezone:"Asia/Seoul",latitude:37.5665,longitude:126.978};
const cases = [
  [{}, 200, undefined],
  [{birthAtLocal:"2099-01-01T12:00:00"}, 422, "BIRTH_DATE_IN_FUTURE"],
  [{birthAtLocal:"2024-02-30T12:00:00"}, 400, "VALIDATION_ERROR"],
  [{birthAtLocal:"1995-05-05T15:00:00+09:00"}, 400, "VALIDATION_ERROR"],
  [{latitude:"37.5"}, 400, "VALIDATION_ERROR"],
  [{timezone:"UTC+9"}, 422, "TIMEZONE_NOT_FOUND"],
  [{birthAtLocal:"2021-11-07T01:30:00",timezone:"America/New_York"}, 422, "LOCAL_TIME_AMBIGUOUS"],
  [{birthAtLocal:"2021-03-14T02:30:00",timezone:"America/New_York"}, 422, "LOCAL_TIME_NONEXISTENT"],
  [{birthAtLocal:"1800-01-01T12:00:00"}, 422, "EPHEMERIS_OUT_OF_RANGE"],
  [{birthAtLocal:"0001-01-01T00:00:00"}, 422, "EPHEMERIS_OUT_OF_RANGE"],
];
let count = 0;
for (const [patch, status, code] of cases) {
  const input = {...base,...patch};
  const [date,time] = input.birthAtLocal.split("T");
  const internal = {birth_date:date,birth_time_local:time,timezone:input.timezone,latitude:input.latitude,longitude:input.longitude};
  const failures = [];
  for (const [origin, payload] of [[next,input],[python,internal]]) {
    const requestId = `policy-${randomUUID()}`;
    const response = await fetch(`${origin}/api/v1/readings/preview`, {
      method:"POST", headers:{"content-type":"application/json","x-request-id":requestId},
      body:JSON.stringify(payload), signal:AbortSignal.timeout(30000),
    });
    const body = await response.json();
    assert.equal(response.status,status,JSON.stringify(body));
    assert.equal(response.headers.get("x-request-id"),requestId);
    assert.match(response.headers.get("server-timing") || "",/total;dur=\d/);
    assert.equal(body.success,status === 200);
    if (origin === next) assert.equal(body.meta.requestId,requestId);
    if (code) {
      assert.equal(body.error.code,code);
      assert.equal(body.error.category,"input");
      assert(body.error.recovery.length > 0);
      assert(!JSON.stringify(body.error.details).includes(input.birthAtLocal));
      if (origin === python) assert.equal(body.error.request_id,requestId);
      failures.push(body.error.message);
    } else {
      assert.match(response.headers.get("server-timing"),/astronomy;dur=\d/);
      assert.equal(origin === next ? body.data.zenithStar.hipId : body.data.selected_star.id,24608);
    }
    count++;
  }
  if (code) assert.equal(failures[0],failures[1],"both servers must give the same recovery guidance");
}
console.log(`PASS: ${count} real HTTP requests; matching errors/status/recovery, request IDs, timings and real ephemeris boundaries.`);
