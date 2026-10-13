"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadSavedReadings, type SavedReading } from "@/lib/readings/browser-library";
import { ReadingCard } from "@/components/reading/ReadingCard";
import { Icon } from "@/components/ui/Icon";

export function SavedReadings() {
  const [entries, setEntries] = useState<SavedReading[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SavedReading | null>(null);
  useEffect(() => {
    try { setEntries(loadSavedReadings()); }
    catch { setError("이 브라우저의 보관함을 불러올 수 없어요. 브라우저의 저장 공간 설정을 확인해 주세요."); }
    setReady(true);
  }, []);

  if (!ready) return <p className="help" role="status">보관한 별을 불러오는 중이에요.</p>;
  if (error) return <p className="error" role="alert">{error}</p>;
  if (selected) return <div className="saved-reading-view"><button className="text-button" onClick={() => setSelected(null)}>← 보관함으로 돌아가기</button><ReadingCard data={selected.data} saved /></div>;
  if (!entries.length) return <div className="empty-collection"><Icon name="book" /><h2>당신의 첫 번째 별을 기다려요.</h2><p>나의 별을 찾고, 오래 간직하고 싶은 리딩을 보관해 보세요.</p><Link href="/readings/preview" className="button">나의 별 찾기 <Icon name="arrow" /></Link></div>;
  return <div className="collection-grid">{entries.map(entry => <article key={entry.id} className="saved-item"><button onClick={() => setSelected(entry)}><span className="eyebrow">{entry.data.input.birthTimeUnknown ? "시간 모름 · 참고 리딩" : "MY STAR JOURNAL"}</span><h2>{entry.data.zenithStar.name}</h2><p>{entry.data.zenithStar.constellationName}</p><p>{entry.data.input.birthTimeUnknown ? entry.data.input.birthAtLocal.slice(0, 10) + " · 시간 모름" : entry.data.input.birthAtLocal.slice(0, 16).replace("T", " · ")} · {entry.data.input.locationName}</p><span className="saved-open">리딩 펼쳐보기<Icon name="arrow" /></span></button></article>)}</div>;
}
