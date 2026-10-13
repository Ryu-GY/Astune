"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { apiClient, postJson } from "@/lib/utils/api-client";
import type { ReadingPreviewResponse } from "@/types/reading";
import { Icon, type IconName } from "@/components/ui/Icon";
import { BirthTimeNotice } from "./BirthTimeNotice";

const categories: { type: "personality" | "love" | "career" | "money"; title: string; icon: IconName }[] = [
  { type: "personality", title: "성향", icon: "star" },
  { type: "love", title: "연애", icon: "heart" },
  { type: "career", title: "일", icon: "work" },
  { type: "money", title: "재물", icon: "coins" },
];

export function ReadingCard({ data: initialData, accountSaved = false }: { data: ReadingPreviewResponse; accountSaved?: boolean }) {
  const { data: session, isPending } = authClient.useSession();
  const [stored, setStored] = useState<ReadingPreviewResponse | null>(null);
  const data = stored || initialData;
  const [cloudSaved, setCloudSaved] = useState(accountSaved);
  const [saving, setSaving] = useState(false);
  const [saveProfile, setSaveProfile] = useState(false);
  const [profileLabel, setProfileLabel] = useState("");
  const scoreId = useId();
  const [saveError, setSaveError] = useState("");
  async function saveAccount() {
    setSaving(true); setSaveError("");
    try {
      const response = await apiClient<{ preview: ReadingPreviewResponse }>("/api/v1/readings", postJson({ ...data.input, saveBirthProfile: saveProfile, profileLabel: profileLabel || undefined }));
      setStored(response.preview); setCloudSaved(true);
    } catch (error) { setSaveError(error instanceof Error ? error.message : "계정에 저장하지 못했어요."); }
    finally { setSaving(false); }
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
    <section className="reading-overview" aria-label="총평 상세"><h3>당신의 별이 들려주는 이야기</h3>{data.interpretation.sections.find(section => section.type === "overview")?.content.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>
    <div className="reading-accordion">
      {categories.map(category => <details className="reading-section" key={category.type} open={category.type === "personality"}><summary><Icon name={category.icon} /><strong>{category.title}</strong></summary>{(data.interpretation.sections.find(section => section.type === category.type)?.content || (category.type !== "personality" ? data.reading[category.type] : "")).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</details>)}
    </div>
    <div className="score-list">{data.interpretation.scores.map(score => <div className="score-item" key={score.dimension}><div><label htmlFor={scoreId + score.dimension}>{categories.find(item => item.type === score.dimension)?.title}</label><span>{score.score} / 100</span></div><meter id={scoreId + score.dimension} value={score.score} min={0} max={100}>{score.score}</meter></div>)}</div>
    <p className="help">{data.input.birthTimeUnknown ? "점수도 낮 12시 기준의 참고값이며 출생 시각에 따라 달라집니다. " : ""}점수는 별의 위치와 해석 규칙을 조합한 상징적 지표입니다.</p>
    <div className="result-actions">
      {isPending ? <p className="help" role="status">로그인 상태 확인 중</p> : session ? <>
        {!cloudSaved && !data.input.birthTimeUnknown ? <><label className="help"><input type="checkbox" checked={saveProfile} onChange={event => setSaveProfile(event.target.checked)} /> 출생 정보도 프로필로 저장하기</label>{saveProfile ? <label className="label">프로필 이름<input className="input" maxLength={80} value={profileLabel} onChange={event => setProfileLabel(event.target.value)} placeholder="예: 나의 출생 정보" /></label> : null}</> : null}
        <button className="button" onClick={saveAccount} disabled={saving || cloudSaved}>{cloudSaved ? "계정에 저장했어요" : saving ? "계정에 저장 중" : "내 계정에 리딩 저장하기"}</button>
      </> : <><p className="help">게스트의 리딩과 출생 정보는 저장되지 않아요. 새로고침하거나 페이지를 떠나면 결과가 사라집니다.</p><Link className="button" href="/login?next=/readings/preview">Google 로그인 후 리딩 저장하기</Link><p className="help">로그인 후 출생 정보를 다시 입력해 주세요.</p></>}
      {saveError ? <p className="error" role="alert">{saveError}</p> : null}
    </div>
    <details className="result-details"><summary>그날의 하늘 자세히 보기</summary><dl className="kv"><dt>출생 장소</dt><dd>{data.input.locationName || data.input.latitude + ", " + data.input.longitude}</dd><dt>{data.input.birthTimeUnknown ? "계산 기준 시각" : "현지 시각"}</dt><dd>{data.input.birthAtLocal.replace("T", " ")} ({data.input.timezone}){data.input.birthTimeUnknown ? " · 실제 출생 시각이 아닙니다" : ""}</dd><dt>{data.input.birthTimeUnknown ? "참고 별" : "대표 별"}</dt><dd>{data.zenithStar.name} · HIP {data.zenithStar.hipId}</dd><dt>천정 거리</dt><dd>{data.zenithStar.zenithDistanceDeg.toFixed(2)}°</dd><dt>밝기 등급</dt><dd>{data.zenithStar.magnitude}</dd><dt>계산 기준</dt><dd>{data.astronomyMeta.sourceLabel} · {data.astronomyMeta.engineName}</dd></dl></details>
  </article>;
}
