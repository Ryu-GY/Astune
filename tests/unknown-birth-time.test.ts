import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePreviewInput, previewReading } from "../src/server/services/preview-service";
import { createReadingSchema } from "../src/lib/validation/reading";
import { UNKNOWN_BIRTH_TIME_WARNING } from "../src/lib/readings/birth-time";
import { saveReading, loadSavedReadings } from "../src/lib/readings/browser-library";
import type { PreviewReadingInput } from "../src/types/reading";

const location = {timezone:"Asia/Seoul", locationName:"서울", latitude:37.5665, longitude:126.978};
const astro = {
  selectedStar:{id:24608,displayName:"Capella",magnitude:0.08},
  selectedConstellation:{code:"Aur",nameKo:"마차부자리"},
  metrics:{altitudeDeg:60,azimuthDeg:170,zenithDistanceDeg:30},
};
const astronomyMeta = {sourceLabel:"fixture",catalogVersion:"test",engineName:"test",candidateCount:10,calculatedAtUtc:"1995-05-05T03:00:00Z"};

test("unknown birth time accepts date only and always uses labelled local noon", () => {
  const unknown = normalizePreviewInput({...location,birthAtLocal:"1995-05-05",birthTimeUnknown:true});
  assert.equal(unknown.birthAtLocal,"1995-05-05T12:00:00");
  assert.equal(unknown.birthTimeUnknown,true);
  const suppliedTime = normalizePreviewInput({...location,birthAtLocal:"1995-05-05T23:59:00",birthTimeUnknown:true,dstFold:1});
  assert.equal(suppliedTime.birthAtLocal,unknown.birthAtLocal);
  assert.equal(suppliedTime.dstFold,undefined);
  const split = normalizePreviewInput({...location,birthDate:"1995-05-05",birthTimeUnknown:true});
  assert.deepEqual(split,unknown);
  assert.equal(createReadingSchema.parse({...location,birthAtLocal:"1995-05-05",birthTimeUnknown:true}).birthAtLocal,unknown.birthAtLocal);
});

test("known time remains required and unknown inputs cannot hide invalid dates or create exact-time profiles", () => {
  const known = {...location,birthAtLocal:"1995-05-05T15:00:00"};
  assert.equal(normalizePreviewInput(known).birthAtLocal,known.birthAtLocal);
  for (const input of [
    {...location,birthAtLocal:"1995-05-05"},
    {...location,birthAtLocal:"1995-02-30",birthTimeUnknown:true},
    {...known,birthTimeUnknown:"true"},
    {...location,birthDate:"1995-05-05",birthTimeUnknown:"true"},
  ]) assert.throws(()=>normalizePreviewInput(input));
  assert.throws(()=>createReadingSchema.parse({...known,birthTimeUnknown:true,saveBirthProfile:true}));
});

test("preview passes reference noon to astronomy and flags the returned reading; known readings have no notice", async () => {
  let calculated: PreviewReadingInput | undefined;
  const calculate = async (input: PreviewReadingInput) => {calculated=input; return {astro,astronomyMeta};};
  const unknown = await previewReading({...location,birthAtLocal:"1995-05-05",birthTimeUnknown:true}, {calculate});
  assert.equal(calculated?.birthAtLocal,"1995-05-05T12:00:00");
  assert.equal(unknown.input.birthTimeUnknown,true);
  assert.equal(unknown.calculationNotice?.code,"BIRTH_TIME_UNKNOWN");
  assert.equal(unknown.calculationNotice?.message,UNKNOWN_BIRTH_TIME_WARNING);
  assert.match(unknown.reading.title,/참고 리딩/);
  assert(!unknown.reading.summary.includes("출생 시각"));
  const known = await previewReading({...location,birthAtLocal:"1995-05-05T15:00:00"}, {calculate});
  assert.equal(known.calculationNotice,undefined);
  assert.equal(calculated?.birthAtLocal,"1995-05-05T15:00:00");
});

test("browser library preserves the unknown flag and warning after reload and reads older known-time records", async t => {
  const previous=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const data=new Map<string,string>();
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value)}});
  t.after(()=>{if(previous)Object.defineProperty(globalThis,"localStorage",previous); else Reflect.deleteProperty(globalThis,"localStorage");});
  const calculate = async () => ({astro,astronomyMeta});
  const unknown = await previewReading({...location,birthAtLocal:"1995-05-05",birthTimeUnknown:true}, {calculate});
  saveReading(unknown);
  const loaded=loadSavedReadings()[0].data;
  assert.equal(loaded.input.birthTimeUnknown,true);
  assert.deepEqual(loaded.calculationNotice,unknown.calculationNotice);
  saveReading(await previewReading({...location,birthAtLocal:"1995-05-05T15:00:00"},{calculate}));
  const both=loadSavedReadings();
  assert.equal(both.length,2);
  assert.equal(both[0].data.input.birthTimeUnknown,undefined);
  assert.equal(both[1].data.input.birthTimeUnknown,true);
});
