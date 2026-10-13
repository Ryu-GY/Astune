"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ReadingCard } from "@/components/reading/ReadingCard";
import { StarFeature } from "@/components/reading/StarFeature";
import { Icon } from "@/components/ui/Icon";
import type { ReadingPreviewResponse } from "@/types/reading";
import type { ApiResponse } from "@/types/api";
import { CitySearch, type BirthLocation } from "./CitySearch";
import { SavedBirthProfilePicker } from "./SavedBirthProfilePicker";
import type { BirthProfile } from "@/types/birth-profile";
import { countryCodeFor } from "@/lib/geocoding/countries";
import { BirthTimeNotice } from "@/components/reading/BirthTimeNotice";
import timeStyles from "@/components/reading/BirthTimeNotice.module.css";
import { DEFAULT_READING_MAX_MAGNITUDE } from "@/lib/readings/coverage";

export function PreviewReadingForm({ birthProfileId }: { birthProfileId?: string }) {
  const [birthDate, setBirthDate] = useState("2000-01-01");
  const [birthTime, setBirthTime] = useState("00:00");
  const [birthTimeUnknown, setBirthTimeUnknown] = useState(false);
  const [location, setLocation] = useState<BirthLocation | null>(null);
  const [locationRevision, setLocationRevision] = useState(0);
  const [profileMessage, setProfileMessage] = useState("");
  const [name, setName] = useState("");
  const [maxMagnitude, setMaxMagnitude] = useState(String(DEFAULT_READING_MAX_MAGNITUDE));
  const [dstFold, setDstFold] = useState("");
  const [result, setResult] = useState<ReadingPreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const useProfile = useCallback((profile: BirthProfile) => {
    const input = profile.input;
    const [date, time = "12:00:00"] = input.birthAtLocal.split("T");
    setBirthDate(date); setBirthTime(time); setBirthTimeUnknown(input.birthTimeUnknown ?? false);
    setName(input.name ?? ""); setMaxMagnitude(String(input.maxMagnitude ?? DEFAULT_READING_MAX_MAGNITUDE));
    setDstFold(input.dstFold == null ? "" : String(input.dstFold));
    setLocation({ locationName: input.locationName ?? profile.label, latitude: input.latitude,
      longitude: input.longitude, timezone: input.timezone,
      countryCode: countryCodeFor(input.locationName?.split(/[,·]/).at(-1) ?? "") ?? null });
    setLocationRevision(value => value + 1);
    setResult(null); setError("");
    setProfileMessage(`‘${profile.label}’의 출생 시각과 위치를 불러왔어요. 아래에서 바로 별을 찾아보세요.`);
  }, []);

  useEffect(() => {
    if (result) {
      resultRef.current?.focus({ preventScroll: true });
      resultRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    }
  }, [result]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    if (!location) {
      setError("도시를 검색하고 결과에서 태어난 도시를 선택해 주세요.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch("/api/v1/readings/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationName: location.locationName, timezone: location.timezone,
          latitude: location.latitude, longitude: location.longitude,
          ...(name.trim() ? { name: name.trim() } : {}),
          birthAtLocal: birthTimeUnknown ? birthDate : birthDate + "T" + (birthTime.length === 5 ? birthTime + ":00" : birthTime),
          birthTimeUnknown,
          maxMagnitude: Number(maxMagnitude),
          ...(!birthTimeUnknown && dstFold !== "" ? { dstFold: Number(dstFold) } : {}),
        }),
      });
      const json = await response.json() as ApiResponse<Omit<ReadingPreviewResponse, "ok">>;
      if (!response.ok || !json.success) {
        throw new Error(response.status >= 500
          ? "별을 찾는 서비스에 잠시 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
          : !json.success ? json.error.message : "별을 찾지 못했어요. 입력한 정보를 확인하고 다시 시도해 주세요.");
      }
      setResult({ ok: true, ...json.data });
    } catch (caught) {
      setError(caught instanceof Error && caught.message !== "Failed to fetch" ? caught.message : "연결이 잠시 끊겼어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="reading-workspace">
    <div className="reading-start">
      <div className="intro">
        <div className="intro-kicker"><span>A SMALL STAR<br />A BRIGHTER YOU</span><span className="fine-rule" /><Icon name="star" /></div>
        <h1>태어난 순간,<br /><span>당신의 별을 만나다.</span></h1>
        <p>출생 시각과 장소로 찾는 나의 대표 별</p>
      </div>
      <form className="birth-form" onSubmit={submit} aria-label="출생 정보 입력" aria-busy={loading}>
        <fieldset disabled={loading}>
          <legend className="sr-only">나의 출생 정보</legend>
          <SavedBirthProfilePicker initialId={birthProfileId} onSelect={useProfile} disabled={loading} />
          {profileMessage ? <p className="help" role="status">{profileMessage}</p> : null}
          <div className="birth-fields">
            <div><label className="label" htmlFor="birth-date">생년월일</label><input className="input" id="birth-date" type="date" required value={birthDate} onChange={event => setBirthDate(event.target.value)} /></div>
            <div><label className="label" htmlFor="birth-time">태어난 시간</label><input className="input" id="birth-time" type="time" step="1" required={!birthTimeUnknown} disabled={birthTimeUnknown} value={birthTimeUnknown ? "" : birthTime} onChange={event => setBirthTime(event.target.value)} /><label className={timeStyles.option}><input type="checkbox" checked={birthTimeUnknown} onChange={event => { setBirthTimeUnknown(event.target.checked); setResult(null); setError(""); }} />태어난 시간 모름</label></div>
          </div>
          {birthTimeUnknown ? <BirthTimeNotice /> : null}
          <CitySearch key={locationRevision} value={location} onChange={next => { setLocation(next); setResult(null); setError(""); setDstFold(""); setProfileMessage(""); }} disabled={loading} />
          <details className="advanced-options"><summary>세부 설정 <span>이름 · 별의 밝기 · 서머타임</span></summary><div className="advanced-content">
            <div><label htmlFor="name" className="label">이름 <span className="optional">선택</span></label><input className="input" id="name" value={name} maxLength={50} onChange={event => setName(event.target.value)} placeholder="어떻게 불러드릴까요?" /></div>
            <div><label htmlFor="maxMagnitude" className="label">계산할 별의 최대 등급</label><input id="maxMagnitude" className="input" type="number" min="-2" max="5.5" step="0.1" required value={maxMagnitude} onChange={event => setMaxMagnitude(event.target.value)} /><p className="help">기본 2.5등급 · 93개 별의 개별 해설. 최대 5.5등급까지 계산할 수 있으며, 추가 범위의 별은 해설이 준비되지 않았을 수 있어요.</p></div>
            <div><label htmlFor="dstFold" className="label">서머타임으로 출생 시간이 겹치는 경우</label><select className="select" id="dstFold" disabled={birthTimeUnknown} value={birthTimeUnknown ? "" : dstFold} onChange={event => setDstFold(event.target.value)}><option value="">해당 없음 / 확인 필요</option><option value="0">첫 번째 시각</option><option value="1">두 번째 시각</option></select></div>
          </div></details>
          <button className="button find-star-button" type="submit">{loading ? <><span className="loading-star"><Icon name="star" /></span>그날의 하늘을 살펴보는 중</> : <>{birthTimeUnknown ? "참고 리딩 보기" : "나의 별 찾기"} <Icon name="arrow" /></>}</button>
        </fieldset>
        <div className="form-feedback" aria-live="polite">{loading ? <p className="help">잠시만 기다려 주세요.</p> : null}{error ? <p className="error" role="alert">{error}</p> : null}</div>
        <p className="form-note">태어난 곳의 현지 시각을 입력해 주세요.</p>
        <div className="form-signature" aria-hidden="true"><span>SAME SKY, A BRIGHTER YOU</span><span className="fine-rule" /></div>
      </form>
    </div>
    <div className="reading-display" ref={resultRef} tabIndex={-1} aria-label={result ? "나의 별 리딩 결과" : "별 리딩 예시"}>
      {result ? <ReadingCard data={result} key={JSON.stringify(result.input)} /> : <StarFeature />}
    </div>
  </div>;
}
