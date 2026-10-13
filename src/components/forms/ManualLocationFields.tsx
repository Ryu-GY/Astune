"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MapCoordinates } from "./LocationMap";
import styles from "./LocationMap.module.css";
import type { ApiResponse } from "@/types/api";

const LocationMap = dynamic(() => import("./LocationMap"), {
  ssr: false, loading: () => <p className="help" role="status">지도를 불러오는 중…</p>,
});
export type ManualLocation = { locationName: string; timezone: string; latitude: string; longitude: string };

export function ManualLocationFields({ value, onChange, disabled = false }: {
  value: ManualLocation; onChange: Dispatch<SetStateAction<ManualLocation>>; disabled?: boolean;
}) {
  const pending = useRef<AbortController | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => () => pending.current?.abort(), []);

  function edit(field: keyof ManualLocation, text: string) {
    if (field !== "locationName") pending.current?.abort();
    const changedCoordinate = field === "latitude" || field === "longitude";
    setMessage(changedCoordinate ? "좌표를 입력한 뒤 시간대를 찾거나 직접 입력해 주세요." : "");
    onChange(previous => ({ ...previous, [field]: text, ...(changedCoordinate ? { timezone: "" } : {}) }));
  }

  async function choose(point: MapCoordinates) {
    if (disabled) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    onChange(previous => ({ ...previous, latitude: String(point.latitude), longitude: String(point.longitude),
      locationName: previous.locationName || "지도에서 선택한 위치", timezone: "" }));
    setMessage("좌표를 입력했어요. 시간대를 확인하고 있습니다…");
    try {
      const response = await fetch("/api/v1/locations/resolve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(point), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
      });
      const data = await response.json() as ApiResponse<{ candidates: { timezone: string }[] }>;
      if (controller.signal.aborted) return;
      const timezone = data.success ? data.data.candidates[0]?.timezone : undefined;
      if (!response.ok || typeof timezone !== "string" || !timezone) {
        throw new Error(!data.success ? data.error.message : "시간대를 찾지 못했어요. 아래 시간대를 직접 입력해 주세요.");
      }
      onChange(previous => ({ ...previous, timezone }));
      setMessage(`위도·경도와 시간대(${timezone})를 입력했어요. 도시 이름은 자유롭게 수정할 수 있습니다.`);
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error && error.message !== "Failed to fetch" && error.name !== "TimeoutError"
        ? error.message : "좌표는 입력했지만 시간대를 확인하지 못했어요. 아래 시간대를 직접 입력해 주세요.");
    }
  }

  const latitude = value.latitude.trim() === "" ? NaN : Number(value.latitude);
  const longitude = value.longitude.trim() === "" ? NaN : Number(value.longitude);
  const validPoint = Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
  return <div className={styles.fields}>
    <div inert={disabled}><LocationMap latitude={validPoint ? latitude : 37.5665} longitude={validPoint ? longitude : 126.978} onChoose={choose} /></div>
    <p className="help" role="status" aria-live="polite">{message}</p>
    <div><label className="label" htmlFor="location-name">도시 이름</label><input id="location-name" className="input" required maxLength={120} value={value.locationName} onChange={event => edit("locationName", event.target.value)} /></div>
    <div className={styles.coordinates}>
      <div><label className="label" htmlFor="latitude">위도</label><input id="latitude" className="input" type="number" required min={-90} max={90} step="any" value={value.latitude} onChange={event => edit("latitude", event.target.value)} /></div>
      <div><label className="label" htmlFor="longitude">경도</label><input id="longitude" className="input" type="number" required min={-180} max={180} step="any" value={value.longitude} onChange={event => edit("longitude", event.target.value)} /></div>
    </div>
    <button className={styles.centerButton} type="button" disabled={!validPoint || disabled} onClick={() => choose({latitude, longitude})}>입력한 좌표로 시간대 찾기</button>
    <div><label className="label" htmlFor="timezone">시간대</label><input id="timezone" className="input" required placeholder="예: Asia/Seoul" value={value.timezone} onChange={event => edit("timezone", event.target.value)} /><p className="help">자동으로 찾은 시간대가 다르면 직접 수정해 주세요.</p></div>
  </div>;
}
