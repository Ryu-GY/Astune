"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type SetStateAction } from "react";
import type { ApiResponse } from "@/types/api";
import { countries, countryCodeFor, countryNameFor } from "@/lib/geocoding/countries";
import styles from "./CitySearch.module.css";
import { ManualLocationFields, type ManualLocation } from "./ManualLocationFields";

type Candidate = {
  displayName: string; countryCode: string | null; latitude: number; longitude: number;
  timezone: string; source: "city_table" | "coordinates" | "geocoder"; attribution: string | null;
};
export type BirthLocation = Pick<Candidate, "latitude" | "longitude" | "timezone" | "countryCode"> & { locationName: string };

export function CitySearch({ value, onChange, disabled = false }: {
  value: BirthLocation | null; onChange: (location: BirthLocation | null) => void; disabled?: boolean;
}) {
  const [country, setCountry] = useState(() => value ? countryNameFor(value.countryCode) : "대한민국");
  const [query, setQuery] = useState(() => value?.locationName.split(/[,·]/)[0].trim() ?? "");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attribution, setAttribution] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  function edit(field: "country" | "city", text: string) {
    pending.current?.abort();
    pending.current = null;
    setSearching(false);
    setCandidates([]);
    setMessage("");
    setError("");
    setAttribution(false);
    onChange(null); // A typed label must never reuse coordinates from an earlier selection.
    if (field === "country") setCountry(text); else setQuery(text);
  }

  async function search() {
    if (disabled || searching) return;
    const countryCode = countryCodeFor(country);
    setError("");
    if (!countryCode) { setError("나라 이름을 확인해 주세요. 예: 대한민국, 일본, 미국"); return; }
    if (query.trim().length < 2) { setError("도시 이름을 두 글자 이상 입력해 주세요."); return; }
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setSearching(true);
    setCandidates([]);
    setMessage("");
    setAttribution(false);
    onChange(null);
    try {
      const response = await fetch("/api/v1/locations/resolve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), countryCode, allowExternal: true, limit: 10 }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(130000)]),
      });
      const body = await response.json() as ApiResponse<{ candidates: Candidate[] }>;
      if (controller.signal.aborted) return;
      if (!response.ok || !body.success) {
        throw new Error(response.status === 429 ? "검색이 잠시 몰렸어요. 잠시 후 다시 검색해 주세요."
          : "도시 검색에 연결하지 못했어요. 잠시 후 다시 검색해 주세요.");
      }
      setCandidates(body.data.candidates);
      setAttribution(body.data.candidates.some(item => item.source === "geocoder"));
      setMessage(body.data.candidates.length ? `${body.data.candidates.length}곳을 찾았어요. 태어난 도시를 선택해 주세요.`
        : "검색 결과가 없어요. 나라를 확인하거나 도시 이름을 한글·영문으로 바꿔 검색해 주세요.");
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error && !["TypeError", "TimeoutError", "SyntaxError"].includes(caught.name)
        ? caught.message : "도시 검색에 연결하지 못했어요. 잠시 후 다시 검색해 주세요.");
    } finally {
      if (pending.current === controller) { pending.current = null; setSearching(false); }
    }
  }

  function select(candidate: Candidate) {
    onChange({ locationName: candidate.displayName, countryCode: candidate.countryCode,
      latitude: candidate.latitude, longitude: candidate.longitude, timezone: candidate.timezone });
    setCandidates([]);
    setMessage("");
  }

  function enter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault(); // Search never submits the surrounding reading form.
      if (!event.nativeEvent.isComposing) void search();
    }
  }

  return <div className={styles.root} aria-busy={searching}>
    <p className={styles.title}>태어난 도시</p>
    <button className="text-button" type="button" disabled={disabled} aria-pressed={manualMode} onClick={() => {
      pending.current?.abort(); pending.current = null;
      setSearching(false); setCandidates([]); setMessage(""); setError(""); setAttribution(false);
      onChange(null); setManualMode(previous => !previous);
    }}>{manualMode ? "도시 이름으로 검색하기" : "지도에서 선택 · 좌표 직접 입력"}</button>
    {manualMode ? <ManualCityPicker onChange={onChange} disabled={disabled} /> : <>
    <div className={styles.fields}>
      <div><label className="label" htmlFor="birth-country">나라</label>
        <input className="input" id="birth-country" list="birth-countries" autoComplete="country-name" maxLength={80}
          value={country} onChange={event => edit("country", event.target.value)} onKeyDown={enter} disabled={disabled} />
        <datalist id="birth-countries">{countries.map(item => <option key={item.code} value={item.name}>{item.englishName} · {item.code}</option>)}</datalist>
      </div>
      <div><label className="label" htmlFor="birth-city">도시 이름</label>
        <input className="input" id="birth-city" autoComplete="address-level2" placeholder="예: 서울, 수원시, 오사카" maxLength={100}
          value={query} onChange={event => edit("city", event.target.value)} onKeyDown={enter} disabled={disabled} aria-describedby="city-search-hint" />
      </div>
    </div>
    <button className={styles.searchButton} type="button" onClick={() => void search()} disabled={disabled || searching}>
      {searching ? "도시를 찾는 중…" : "도시 검색"}
    </button>
    <p className={styles.hint} id="city-search-hint">나라와 도시를 입력하고 검색 결과에서 선택해 주세요. 같은 이름이 있다면 시·군까지 입력해 보세요.</p>
    <div role="status" aria-live="polite">{searching ? <p className="help">도시 위치를 확인하고 있어요.</p> : message ? <p className="help">{message}</p> : null}</div>
    {error ? <p className="error" role="alert">{error}</p> : null}
    {candidates.length ? <ul className={styles.results} aria-label="도시 검색 결과">{candidates.map((item, index) =>
      <li key={`${item.latitude}:${item.longitude}:${index}`}><button type="button" onClick={() => select(item)} disabled={disabled}>
        <span className={styles.resultName}>{item.displayName}</span>
        <span className={styles.resultMeta}>{countryNameFor(item.countryCode)} · {item.timezone}</span>
        <span className={styles.choose}>선택</span>
      </button></li>)}</ul> : null}
    {value ? <div className={styles.selected} role="status">
      <span className={styles.selectedLabel}>선택한 출생지</span>
      <strong>{value.locationName}</strong>
      <span>{countryNameFor(value.countryCode)} · {value.timezone}</span>
      <p>이 도시의 좌표와 시간대가 자동 적용되었어요.</p>
    </div> : null}
    {attribution ? <p className={styles.attribution}>위치 정보: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a></p> : null}
    </>}
  </div>;
}

function ManualCityPicker({ onChange, disabled }: {
  onChange: (location: BirthLocation | null) => void; disabled: boolean;
}) {
  const [manual, setManual] = useState<ManualLocation>({ locationName: "", latitude: "", longitude: "", timezone: "" });
  const latest = useRef(manual);
  function update(action: SetStateAction<ManualLocation>) {
    const next = typeof action === "function" ? action(latest.current) : action;
    latest.current = next;
    setManual(next);
    const latitude = Number(next.latitude), longitude = Number(next.longitude);
    const valid = next.latitude.trim() !== "" && next.longitude.trim() !== "" && Number.isFinite(latitude) && Number.isFinite(longitude)
      && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && next.timezone.trim() && next.locationName.trim();
    onChange(valid ? { locationName: next.locationName.trim(), latitude, longitude, timezone: next.timezone.trim(), countryCode: null } : null);
  }
  return <ManualLocationFields value={manual} onChange={update} disabled={disabled} />;
}
