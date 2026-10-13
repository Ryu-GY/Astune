/** Synthetic, varied requests through real HTTP; no saved user birth data. */
import { performance } from "node:perf_hooks";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, "").split("=")));
const count = Number(options.requests || 100);
const levels = (options.concurrency || "1,4").split(",").map(Number);
const limit = Number(options["limit-ms"] || 2500);
if (!Number.isInteger(count) || count < 20 || count > 1000 || levels.some(n => !Number.isInteger(n) || n < 1 || n > 16)) {
  throw new Error("Use --requests=20..1000 and --concurrency=1,4 (each 1..16)");
}
const places = [
  [37.5665,126.978,"Asia/Seoul"], [-33.8688,151.2093,"Australia/Sydney"],
  [40.7128,-74.006,"America/New_York"], [51.5072,-0.1276,"Europe/London"],
];
function input(index, python) {
  const [latitude,longitude,timezone] = places[index % places.length];
  const date = new Date(Date.UTC(1980 + index % 45, index % 12, 1 + index % 27)).toISOString().slice(0,10);
  const clock = `12:${String(index % 60).padStart(2,"0")}:00`;
  return python
    ? {birth_date:date,birth_time_local:clock,latitude,longitude,timezone,max_magnitude:5.5}
    : {birthAtLocal:`${date}T${clock}`,latitude,longitude,timezone,locationName:"Synthetic benchmark",maxMagnitude:5.5};
}
function quantile(values, q) {
  const sorted = [...values].sort((a,b) => a-b);
  return Number(sorted[Math.max(0,Math.ceil(sorted.length*q)-1)].toFixed(2));
}
async function call(target, index) {
  const start = performance.now();
  const response = await fetch(`${target.origin}/api/v1/readings/preview`, {
    method:"POST",headers:{"Content-Type":"application/json",
      ...(target.python && process.env.ASTUNE_ASTRO_API_KEY ? {"X-Astune-Internal-Key":process.env.ASTUNE_ASTRO_API_KEY} : {})},
    body:JSON.stringify(input(index,target.python)),
    signal:AbortSignal.timeout(120000),
  });
  const body = await response.json();
  const elapsed = performance.now()-start;
  if (!response.ok) throw new Error(`${target.name}: HTTP ${response.status} ${JSON.stringify(body)}`);
  const meta = target.python ? body.data?.astronomy_meta : body.data?.astronomyMeta;
  const version = target.python ? meta?.catalog_version : meta?.catalogVersion;
  if (version !== "hipparcos-i239-vmag5.5-v1") throw new Error("Benchmark used an unexpected catalog");
  const metrics = target.python ? body.data.metrics : body.data.zenithStar;
  const altitude = target.python ? metrics.altitude_deg : metrics.altitudeDeg;
  const zenith = target.python ? metrics.zenith_distance_deg : metrics.zenithDistanceDeg;
  if (!(altitude > 0) || Math.abs(altitude+zenith-90) > 0.002) throw new Error("Invalid astronomy result");
  if (!target.python && (body.data.interpretation?.sections?.length !== 5 || body.data.interpretation?.scores?.length !== 4)) {
    throw new Error("Incomplete interpretation response");
  }
  return elapsed;
}
const targets = [
  {name:"FastAPI",origin:options.python || "http://127.0.0.1:8000",python:true},
  {name:"Next.js + FastAPI + interpretation",origin:options.next || "http://127.0.0.1:3000",python:false},
];
const report = {
  measuredAt:new Date().toISOString(), environment:{platform:os.platform(),cpu:os.cpus()[0]?.model,node:process.version},
  methodology:"Real HTTP, worst supported magnitude 5.5, varied synthetic dates/coordinates, no result memoization. Nearest-rank P95; startup/preflight and external geocoding excluded.",
  targets:targets.map(({name,origin})=>({name,origin})),
  targetP95Ms:limit, profiles:[],
};
for (const target of targets) {
  const firstRequestMs = Number((await call(target, 0)).toFixed(2));
  for (let index=1;index<=5;index++) await call(target,index);
  for (const concurrency of levels) {
    let nextIndex = 0;
    const durations = [];
    const started = performance.now();
    await Promise.all(Array.from({length:concurrency},async () => {
      while (nextIndex<count) durations.push(await call(target,nextIndex++));
    }));
    const profile = {target:target.name,concurrency,requests:count,firstRequestMs,
      p50Ms:quantile(durations,0.5),p95Ms:quantile(durations,0.95),maxMs:quantile(durations,1),
      throughputPerSecond:Number((count/((performance.now()-started)/1000)).toFixed(2)),errors:0};
    report.profiles.push(profile);
    console.log(JSON.stringify(profile));
  }
}
report.passed = report.profiles.every(profile => profile.p95Ms < limit);
if (options.output) {
  await mkdir(path.dirname(options.output),{recursive:true});
  await writeFile(options.output,JSON.stringify(report,null,2)+"\n");
}
console.log(`P95 < ${limit} ms: ${report.passed ? "PASS" : "FAIL"}`);
if (!report.passed) process.exitCode=1;
