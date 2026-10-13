"use client";

import { useMemo, useState } from "react";
import { ReadingCard } from "@/components/reading/ReadingCard";
import type { ReadingPreviewResponse } from "@/types/reading";

const DEFAULT_BODY = {
  name: "홍길동",
  birthAtLocal: "1995-05-05T15:00:00",
  timezone: "Asia/Seoul",
  locationName: "Seoul",
  latitude: 37.5665,
  longitude: 126.978,
  maxMagnitude: 2.0
};

export function PreviewReadingForm() {
  const [body, setBody] = useState(DEFAULT_BODY);
  const [result, setResult] = useState<ReadingPreviewResponse | null>(null);
  const [rawResponse, setRawResponse] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [dstFold, setDstFold] = useState<string>("");

  const curlExample = useMemo(
    () =>
      `curl -X POST http://localhost:3000/api/v1/readings/preview \
` +
      `  -H "Content-Type: application/json" \
` +
      `  -d '${JSON.stringify({ ...body, dstFold: dstFold === "" ? undefined : Number(dstFold) })}'`,
    [body, dstFold]
  );

  const update = (key: keyof typeof DEFAULT_BODY, value: string) => {
    setBody((prev) => {
      if (key === "latitude" || key === "longitude" || key === "maxMagnitude") {
        return { ...prev, [key]: Number(value) };
      }

      return { ...prev, [key]: value };
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/v1/readings/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ ...body, dstFold: dstFold === "" ? undefined : Number(dstFold) })
      });

      const text = await response.text();
      setRawResponse(text);

      if (!response.ok) {
        let message = text;
        try { message = JSON.parse(text).error?.message || text; } catch { /* Keep non-JSON error text. */ }
        throw new Error(message);
      }

      const json = JSON.parse(text) as ReadingPreviewResponse;
      setResult(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <form className="card stack" onSubmit={submit}>
        <div>
          <label className="label" htmlFor="name">
            이름
          </label>
          <input
            className="input"
            id="name"
            value={body.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </div>

        <div>
          <label className="label" htmlFor="birthAtLocal">
            출생 일시 (현지시각)
          </label>
          <input
            className="input"
            id="birthAtLocal"
            type="datetime-local"
            value={body.birthAtLocal}
            onChange={(event) => update("birthAtLocal", event.target.value)}
          />
        </div>

        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor="timezone">
              시간대
            </label>
            <input
              className="input"
              id="timezone"
              value={body.timezone}
              onChange={(event) => update("timezone", event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="locationName">
              장소 이름
            </label>
            <input
              className="input"
              id="locationName"
              value={body.locationName}
              onChange={(event) => update("locationName", event.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-2">
          <div>
            <label className="label" htmlFor="latitude">
              위도
            </label>
            <input
              className="input"
              id="latitude"
              type="number"
              step="0.0001"
              value={body.latitude}
              onChange={(event) => update("latitude", event.target.value)}
            />
          </div>

          <div>
            <label className="label" htmlFor="longitude">
              경도
            </label>
            <input
              className="input"
              id="longitude"
              type="number"
              step="0.0001"
              value={body.longitude}
              onChange={(event) => update("longitude", event.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="maxMagnitude">
            계산 대상 최대 등급
          </label>
          <input
            className="input"
            id="maxMagnitude"
            type="number"
            min="-2"
            max="5.5"
            step="0.1"
            value={body.maxMagnitude}
            onChange={(event) => update("maxMagnitude", event.target.value)}
          />
          <p className="help">
            값이 낮을수록 더 밝은 별만 사용합니다. 기본값은 2.0이며, 최대 5.5등급까지 계산할 수 있습니다.
          </p>
        </div>

        <div>
          <label className="label" htmlFor="dstFold">서머타임으로 출생 시간이 두 번 있는 경우</label>
          <select className="select" id="dstFold" value={dstFold} onChange={(event) => setDstFold(event.target.value)}>
            <option value="">해당 없음 / 확인 필요</option>
            <option value="0">첫 번째 시각</option>
            <option value="1">두 번째 시각</option>
          </select>
        </div>
        <button className="button" disabled={loading} type="submit">
          {loading ? "계산 중..." : "미리보기 생성"}
        </button>

        {error ? <p className="error">{error}</p> : null}

        <div className="stack">
          <h3 style={{ margin: 0 }}>API 호출 예시</h3>
          <pre>{curlExample}</pre>
        </div>
      </form>

      <div className="grid" style={{ gap: 20 }}>
        {result ? <ReadingCard data={result} /> : null}

        <div className="card stack">
          <h2 style={{ margin: 0 }}>원본 응답</h2>
          <pre>{rawResponse || "아직 호출 전입니다."}</pre>
        </div>
      </div>
    </div>
  );
}
