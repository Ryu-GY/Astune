import { test } from "node:test";
import assert from "node:assert/strict";
import { zodiacForDate } from "../src/lib/horoscope/zodiac";
import { createDailyHoroscope } from "../src/lib/horoscope/daily";
import { POST } from "../src/app/api/v1/horoscopes/daily/route";

test("birthday zodiac ranges include both boundaries, New Year and leap day", () => {
  const ranges = [
    ["01-20", "02-18", "aquarius"], ["02-19", "03-20", "pisces"],
    ["03-21", "04-19", "aries"], ["04-20", "05-20", "taurus"],
    ["05-21", "06-20", "gemini"], ["06-21", "07-22", "cancer"],
    ["07-23", "08-22", "leo"], ["08-23", "09-22", "virgo"],
    ["09-23", "10-22", "libra"], ["10-23", "11-21", "scorpio"],
    ["11-22", "12-21", "sagittarius"], ["12-22", "01-19", "capricorn"],
  ];
  for (const [start, end, id] of ranges) {
    assert.equal(zodiacForDate(`2000-${start}`).id, id, start);
    assert.equal(zodiacForDate(`2000-${end}`).id, id, end);
  }
  assert.equal(zodiacForDate("2000-02-29").id, "pisces");
  assert.equal(zodiacForDate("2000-01-01").id, "capricorn");
  assert.equal(zodiacForDate("2000-12-31").id, "capricorn");
});

test("horoscopes are stable for the same sign and Korean date, and refresh exactly at Korean midnight", () => {
  const input = { birthDate: "1995-05-05" };
  const first = createDailyHoroscope(input, new Date("2026-10-13T00:00:00Z"));
  const last = createDailyHoroscope(input, new Date("2026-10-13T14:59:59Z"));
  assert.deepEqual(first, last);
  assert.deepEqual(first, createDailyHoroscope({ birthDate: "2000-04-25" }, new Date("2026-10-13T14:59:59Z")));
  const next = createDailyHoroscope(input, new Date("2026-10-13T15:00:00Z"));
  assert.equal(first.date, "2026-10-13");
  assert.equal(next.date, "2026-10-14");
  assert.equal(first.refreshAt, "2026-10-14T00:00:00.000+09:00");
  assert.notEqual(first.title, next.title);
  assert.notDeepEqual(first.sections, next.sections);
  assert.equal(first.sign.id, "taurus");
  assert.deepEqual(first.sections.map(section => section.id), ["love", "work", "money"]);
  assert.notEqual(first.summary, createDailyHoroscope({ birthDate: "1995-08-05" }, new Date("2026-10-13T00:00:00Z")).summary);
});

test("invalid dates and future birthdays are rejected without requiring time or location", () => {
  const now = new Date("2026-10-13T15:00:00Z");
  for (const birthDate of ["", "1995-02-29", "2000-02-30", "1995-5-5", "2000-13-01", "2000-05-05T12:00:00"]) {
    assert.throws(() => createDailyHoroscope({ birthDate }, now));
  }
  assert.throws(() => createDailyHoroscope({ birthDate: "2026-10-15" }, now), { code: "BIRTH_DATE_IN_FUTURE" });
  assert.doesNotThrow(() => createDailyHoroscope({ birthDate: "2026-10-14" }, now));
  assert.throws(() => createDailyHoroscope({ birthDate: "2000-01-01", date: "2099-01-01" }, now));
});

test("daily horoscope public API returns uncached validated results and handles malformed JSON", async () => {
  const request = (body: string) => new Request("http://localhost/api/v1/horoscopes/daily", {
    method: "POST", headers: { "Content-Type": "application/json" }, body,
  });
  const response = await POST(request(JSON.stringify({ birthDate: "1995-05-05" })));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const json = await response.json();
  assert.equal(json.success, true);
  assert.equal(json.data.horoscope.sign.name, "황소자리");
  assert.equal(json.data.horoscope.timeZone, "Asia/Seoul");
  assert.ok(json.meta.requestId);
  for (const body of ["{", JSON.stringify({ birthDate: "1995-02-29" }), JSON.stringify({ birthDate: 19950505 })]) {
    const invalid = await POST(request(body));
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).error.code, "VALIDATION_ERROR");
  }
  assert.equal((await POST(request(JSON.stringify({ birthDate: "9999-01-01" })))).status, 422);
});
