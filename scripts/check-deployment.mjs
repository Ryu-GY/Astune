import assert from "node:assert/strict";

const origin = process.argv[2];
if (!origin || !/^https?:\/\//.test(origin)) throw new Error("Usage: node scripts/check-deployment.mjs https://YOUR-DEPLOYMENT");
const rows = [];
async function check(label, path, status, body, verify) {
  const start = performance.now();
  const response = await fetch(new URL(path, origin), {
    method: body === undefined ? "GET" : "POST", redirect: "manual", signal: AbortSignal.timeout(150000),
    headers: {"Content-Type":"application/json","X-Request-ID":`deploy-check-${rows.length+1}`},
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  assert.equal(response.status, status, `${label}: HTTP ${response.status}`);
  if (path.startsWith("/api/")) {
    const payload = await response.json();
    assert(response.headers.get("x-request-id"), `${label}: missing trace ID`);
    await verify?.(payload);
  }
  rows.push({check:label,status,durationMs:Math.round(performance.now()-start)});
  console.log(JSON.stringify(rows.at(-1)));
}
const birth = {birthAtLocal:"1995-05-05T15:00:00",timezone:"Asia/Seoul",latitude:37.5665,longitude:126.978,locationName:"Seoul"};
await check("preview page", "/readings/preview",200);
await check("login page", "/login",200);
await check("guest cannot save", "/api/v1/readings",401,birth);
await check("guest cannot view account", "/api/v1/me/readings",401);
await check("guest cannot administer", "/api/v1/admin/rule-versions",401);
await check("future date rejected", "/api/v1/readings/preview",422,{...birth,birthAtLocal:"2099-01-01T12:00:00"}, p=>assert.equal(p.error.code,"BIRTH_DATE_IN_FUTURE"));
await check("Seoul location", "/api/v1/locations/resolve",200,{query:"서울"},p=>assert(p.data.candidates.some(c=>c.timezone==="Asia/Seoul")));
await check("astronomy and interpretation", "/api/v1/readings/preview",200,birth,p=>{
  assert(p.data.zenithStar.hipId>0); assert(p.data.astronomyMeta.candidateCount>0);
  assert.equal(p.data.interpretation.sections.length,5);
});
await check("unknown birth time", "/api/v1/readings/preview",200,{...birth,birthAtLocal:"1995-05-05",birthTimeUnknown:true},p=>assert.equal(p.data.calculationNotice.code,"BIRTH_TIME_UNKNOWN"));
await check("repeated warm calculation", "/api/v1/readings/preview",200,birth);
console.log(JSON.stringify({status:"passed",checks:rows.length,note:"Authenticated save/reload and Google OAuth require browser verification."}));
