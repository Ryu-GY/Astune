import { test } from "node:test";
import assert from "node:assert/strict";
import { requestLocations } from "../src/lib/geocoding/core-client";
import { requestRepresentativeStar } from "../src/lib/astronomy/core-client";

test("deployment credentials reach only the upstream and auth failures become service failures", async t => {
  const previousKey = process.env.ASTUNE_ASTRO_API_KEY;
  const previousTimeout = process.env.ASTUNE_ASTRO_TIMEOUT_MS;
  process.env.ASTUNE_ASTRO_API_KEY = "test-only-deployment-secret";
  process.env.ASTUNE_ASTRO_TIMEOUT_MS = "120000";
  t.after(() => {
    if (previousKey === undefined) delete process.env.ASTUNE_ASTRO_API_KEY; else process.env.ASTUNE_ASTRO_API_KEY = previousKey;
    if (previousTimeout === undefined) delete process.env.ASTUNE_ASTRO_TIMEOUT_MS; else process.env.ASTUNE_ASTRO_TIMEOUT_MS = previousTimeout;
  });
  const timeouts: number[] = [];
  const realTimeout = AbortSignal.timeout;
  t.mock.method(AbortSignal, "timeout", (ms: number) => { timeouts.push(ms); return realTimeout(ms); });
  const reject: typeof fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("X-Astune-Internal-Key"), "test-only-deployment-secret");
    return Response.json({success:false,error:{code:"AUTH_REQUIRED",message:"internal auth failed"}}, {status:401});
  };
  await assert.rejects(requestLocations({query:"Seoul",limit:5,allowExternal:false}, reject), {code:"LOCATION_SERVICE_UNAVAILABLE",statusCode:503});
  await assert.rejects(requestRepresentativeStar({birthAtLocal:"1995-05-05T15:00:00",timezone:"Asia/Seoul",latitude:37.5665,longitude:126.978}, reject), {code:"ASTRO_SERVICE_UNAVAILABLE",statusCode:503});
  assert.deepEqual(timeouts, [120000,120000]);
  process.env.ASTUNE_ASTRO_TIMEOUT_MS = "9999999";
  await assert.rejects(requestLocations({query:"Seoul",limit:5,allowExternal:false}, reject));
  assert.equal(timeouts.at(-1),15000);
});
