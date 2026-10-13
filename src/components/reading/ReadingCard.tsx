"use client";

import { useState } from "react";
import type { ReadingPreviewResponse } from "@/types/reading";
import { saveReading } from "@/lib/readings/browser-library";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BirthTimeNotice } from "./BirthTimeNotice";

const categories: { type: "personality" | "love" | "career" | "money"; title: string; icon: IconName }[] = [
  { type: "personality", title: "성향", icon: "star" },
  { type: "love", title: "연애", icon: "heart" },
  { type: "career", title: "일", icon: "work" },
  { type: "money", title: "재물", icon: "coins" },
];

export function ReadingCard({ data, saved = false }: { data: ReadingPreviewResponse; saved?: boolean }) {
  const [isSaved, setIsSaved] = useState(saved);
  const [saveError, setSaveError] = useState("");
  function save() {
    try {
      saveReading(data);
      setIsSaved(true);
      setSaveError("");
    } catch {
      setSaveError("이 기기에 보관하지 못했어요. 브라우저의 저장 공간 설정을 확인해 주세요.");
    }
  }
  return <article className="reading-result">
    {data.input.birthTimeUnknown ? <BirthTimeNotice /> : null}
    <header className="result-heading">
      <div className="result-seal"><Icon name="star" /></div>
      <span className="eyebrow">{data.input.birthTimeUnknown ? "시간 모름 · 낮 12시 기준 참고 별" : data.input.name ? data.input.name + "님의 별" : "YOUR OWN STAR"}</span>
      <h2>{data.zenithStar.name}</h2>
      <p>{data.zenithStar.constellationName} · 고도 {data.zenithStar.altitudeDeg.toFixed(2)}°</p>
      <div className="keyword-list">{data.reading.keywords.map(keyword => <span key={keyword}>{keyword}</span>)}</div>
    </header>
    <p className="result-summary">{data.reading.summary}</p>
    <div className="reading-accordion">
      {categories.map(category => <details className="reading-section" key={category.type} open={category.type === "personality"}><summary><Icon name={category.icon} /><strong>{category.title}</strong></summary><p>{data.interpretation.sections.find(section => section.type === category.type)?.content || (category.type !== "personality" ? data.reading[category.type] : "")}</p></details>)}
    </div>
    <div className="score-list">{data.interpretation.scores.map(score => <div className="score-item" key={score.dimension}><div><label htmlFor={"score-" + score.dimension}>{categories.find(item => item.type === score.dimension)?.title}</label><span>{score.score} / 100</span></div><meter id={"score-" + score.dimension} value={score.score} min={0} max={100}>{score.score}</meter></div>)}</div>
    <p className="help">{data.input.birthTimeUnknown ? "점수도 낮 12시 기준의 참고값이며 출생 시각에 따라 달라집니다. " : ""}점수는 별의 위치와 해석 규칙을 조합한 상징적 지표입니다.</p>
    <div className="result-actions"><button className="button secondary" onClick={save} disabled={isSaved}><Icon name={isSaved ? "check" : "book"} />{isSaved ? "내 리딩에 보관했어요" : "이 기기에 리딩 보관하기"}</button><p className="help" aria-live="polite">{saveError || "이 브라우저에 최근 20개의 리딩을 보관합니다."}</p></div>
    <details className="result-details"><summary>그날의 하늘 자세히 보기</summary><dl className="kv"><dt>출생 장소</dt><dd>{data.input.locationName || data.input.latitude + ", " + data.input.longitude}</dd><dt>{data.input.birthTimeUnknown ? "계산 기준 시각" : "현지 시각"}</dt><dd>{data.input.birthAtLocal.replace("T", " ")} ({data.input.timezone}){data.input.birthTimeUnknown ? " · 실제 출생 시각이 아닙니다" : ""}</dd><dt>{data.input.birthTimeUnknown ? "참고 별" : "대표 별"}</dt><dd>{data.zenithStar.name} · HIP {data.zenithStar.hipId}</dd><dt>천정 거리</dt><dd>{data.zenithStar.zenithDistanceDeg.toFixed(2)}°</dd><dt>밝기 등급</dt><dd>{data.zenithStar.magnitude}</dd><dt>계산 기준</dt><dd>{data.astronomyMeta.sourceLabel} · {data.astronomyMeta.engineName}</dd></dl></details>
  </article>;
}
