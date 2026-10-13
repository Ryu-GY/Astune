import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveLocationBodySchema } from "../src/lib/validation/location";
import { requestLocations } from "../src/lib/geocoding/core-client";

test("location inputs support city or paired coordinates and optional timezones", () => {
  assert.deepEqual(resolveLocationBodySchema.parse({q:"서울", countryCode:"kr"}), {query:"서울", countryCode:"KR", allowExternal:false, limit:5});
  assert.equal(resolveLocationBodySchema.parse({query:"서울", limit:3}).limit, 3);
  assert.equal(resolveLocationBodySchema.parse({latitude:0, longitude:0}).latitude, 0);
  for (const input of [{}, {latitude:1}, {latitude:91, longitude:0}, {q:" "}, {q:"Seoul",allowExternal:"true"}, {query:"서울",q:"Tokyo"}, {query:"서울",limit:0}, {query:"서울",limit:11}, {query:"서울",limit:1.5}]) {
    assert.throws(() => resolveLocationBodySchema.parse(input));
  }
});

test("location adapter preserves candidates, provenance and external opt-in", async () => {
  let sent: Record<string, unknown> = {};
  const fetcher: typeof fetch = async (_url, options) => {
    sent = JSON.parse(String(options?.body));
    return Response.json({success:true, data:{items:[{
      city_name:"Berlin", display_name:"Berlin, Germany", country_code:"DE", latitude:52.52, longitude:13.405,
      timezone:"Europe/Berlin", source:"geocoder", timezone_source:"geocoder", attribution:"Open-Meteo / GeoNames",
    }],cache_hit:true,manual_input_hint:"manual coordinates"}});
  };
  const result = await requestLocations(resolveLocationBodySchema.parse({query:"Berlin",countryCode:"DE",allowExternal:true,limit:3}), fetcher);
  assert.equal(sent.allow_external, true);
  assert.equal(sent.country_code, "DE");
  assert.equal(sent.query, "Berlin");
  assert.equal(sent.limit, 3);
  assert.equal(result.candidates[0].displayName, "Berlin, Germany");
  assert.equal(result.candidates[0].attribution, "Open-Meteo / GeoNames");
  assert.equal(result.cacheHit, true);
});

test("location adapter distinguishes upstream rejection and unavailable data", async () => {
  const input = resolveLocationBodySchema.parse({query:"unknown"});
  const invalid: typeof fetch = async () => Response.json({error:{code:"TIMEZONE_REQUIRED",message:"manual timezone"}}, {status:422});
  await assert.rejects(requestLocations(input, invalid), {code:"TIMEZONE_REQUIRED",statusCode:422});
  const unavailable: typeof fetch = async () => {throw new Error("offline");};
  await assert.rejects(requestLocations(input, unavailable), {code:"LOCATION_SERVICE_UNAVAILABLE",statusCode:503});
  const malformed: typeof fetch = async () => Response.json({success:true,data:{}});
  await assert.rejects(requestLocations(input, malformed), {code:"LOCATION_INVALID_RESPONSE",statusCode:502});
});
