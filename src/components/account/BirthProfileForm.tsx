"use client";
import { useState, type FormEvent } from "react";
import { CitySearch, type BirthLocation } from "@/components/forms/CitySearch";
import { apiClient, postJson } from "@/lib/utils/api-client";
import type { BirthProfile } from "@/types/birth-profile";
import { DEFAULT_READING_MAX_MAGNITUDE } from "@/lib/readings/coverage";

export function BirthProfileForm({ onSaved }: { onSaved: (profile: BirthProfile) => void }) {
  const [label, setLabel] = useState("나의 출생 정보");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [fold, setFold] = useState("");
  const [location, setLocation] = useState<BirthLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!location) { setError("도시를 검색하고 태어난 도시를 선택해 주세요."); return; }
    setSaving(true);
    try {
      const result = await apiClient<{ birthProfile: BirthProfile }>("/api/v1/birth-profiles", postJson({
        profileLabel: label.trim(), ...(name.trim() ? { name: name.trim() } : {}),
        birthAtLocal: `${date}T${time.length === 5 ? time + ":00" : time}`,
        locationName: location.locationName, latitude: location.latitude, longitude: location.longitude,
        timezone: location.timezone, maxMagnitude: DEFAULT_READING_MAX_MAGNITUDE, ...(fold !== "" ? { dstFold: Number(fold) } : {}),
      }));
      onSaved(result.birthProfile);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "출생 정보를 저장하지 못했어요."); }
    finally { setSaving(false); }
  }
  return <form className="birth-profile-form" onSubmit={save} aria-label="출생 정보 저장" aria-busy={saving}>
    <fieldset disabled={saving}>
      <legend className="sr-only">새 출생 정보</legend>
      <div className="birth-fields">
        <div><label className="label" htmlFor="profile-label">저장 이름</label><input id="profile-label" className="input" maxLength={80} required value={label} onChange={e => setLabel(e.target.value)} /></div>
        <div><label className="label" htmlFor="profile-name">이름 <span className="optional">선택</span></label><input id="profile-name" className="input" maxLength={50} value={name} onChange={e => setName(e.target.value)} placeholder="리딩에 표시할 이름" /></div>
      </div>
      <div className="birth-fields">
        <div><label className="label" htmlFor="profile-date">생년월일</label><input id="profile-date" className="input" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="label" htmlFor="profile-time">태어난 시간</label><input id="profile-time" className="input" type="time" step="1" required value={time} onChange={e => setTime(e.target.value)} /></div>
      </div>
      <CitySearch value={location} onChange={next => { setLocation(next); setFold(""); setError(""); }} disabled={saving} />
      <details className="advanced-options"><summary>서머타임 설정</summary><div className="advanced-content">
        <label className="label" htmlFor="profile-fold">서머타임으로 출생 시간이 겹치는 경우</label>
        <select id="profile-fold" className="select" value={fold} onChange={e => setFold(e.target.value)}><option value="">해당 없음 / 확인 필요</option><option value="0">첫 번째 시각</option><option value="1">두 번째 시각</option></select>
      </div></details>
      <p className="help">출생지의 현지 시각을 입력해 주세요. 저장한 정보는 본인 계정에서만 사용할 수 있어요.</p>
      <button className="button" type="submit">{saving ? "저장하는 중…" : "출생 정보 저장하기"}</button>
    </fieldset>
    {error ? <p className="error" role="alert">{error}</p> : null}
  </form>;
}
