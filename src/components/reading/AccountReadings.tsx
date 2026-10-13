"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { AccountAccess } from "@/components/auth/AccountAccess";
import { apiClient, postJson } from "@/lib/utils/api-client";
import type { ReadingPreviewResponse, PreviewReadingInput } from "@/types/reading";
import { ReadingCard } from "./ReadingCard";

type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
type Entry = { id: string; zenithStarName: string; constellationName: string; summary: string; createdAt: string; birthTimeUnknown: boolean };
type Profile = { id: string; label: string; input: PreviewReadingInput };
export function AccountReadings() {
  const { data: session, isPending } = authClient.useSession();
  const [page, setPage] = useState(1);
  const [profilePage, setProfilePage] = useState(1);
  const [readings, setReadings] = useState<Page<Entry> | null>(null);
  const [profiles, setProfiles] = useState<Page<Profile> | null>(null);
  const [selected, setSelected] = useState<ReadingPreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const userId = session?.user.id;
  useEffect(() => {
    const controller = new AbortController();
    setReadings(null); setProfiles(null); setError("");
    if (!userId) { setSelected(null); return () => controller.abort(); }
    Promise.all([
      apiClient<Page<Entry>>(`/api/v1/me/readings?page=${page}&pageSize=12`, { signal: controller.signal }),
      apiClient<Page<Profile>>(`/api/v1/birth-profiles?page=${profilePage}&pageSize=12`, { signal: controller.signal }),
    ]).then(([items, savedProfiles]) => { setReadings(items); setProfiles(savedProfiles); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "보관함을 불러오지 못했어요."); });
    return () => controller.abort();
  }, [userId, page, profilePage, revision]);
  async function open(id: string, reuse = false) {
    setBusy(true); setError("");
    try {
      const result = await apiClient<{ preview: ReadingPreviewResponse }>(reuse ? "/api/v1/readings" : `/api/v1/readings/${id}`, reuse ? postJson({ birthProfileId: id }) : undefined);
      setSelected(result.preview);
      if (reuse) { setPage(1); setRevision(value => value + 1); }
    } catch (error) { setError(error instanceof Error ? error.message : "리딩을 불러오지 못했어요."); }
    finally { setBusy(false); }
  }
  if (isPending) return <p role="status" className="help">계정 확인 중</p>;
  if (!session) return <div className="account-intro"><h2 className="section-title">어디서나 이어 읽는 나의 별</h2><p className="help">Google로 로그인하면 계정에 저장한 리딩과 출생 프로필을 확인할 수 있어요.</p><AccountAccess guestLink={false} /></div>;
  return <section aria-label="계정에 저장한 리딩">
    <AccountAccess />
    {error ? <div role="alert"><p className="error">{error}</p><button className="text-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div> : null}
    {selected ? <div className="saved-reading-view"><button className="text-button" onClick={() => setSelected(null)}>← 계정 보관함으로 돌아가기</button><ReadingCard key={JSON.stringify(selected.input)} data={selected} accountSaved /></div> : <>
      <h2 className="section-title">계정 리딩 {readings ? `· ${readings.total}개` : ""}</h2>
      {!readings && !error ? <p role="status">리딩을 불러오는 중이에요.</p> : null}
      {readings?.total === 0 ? <p className="help">아직 계정에 저장한 리딩이 없어요. 별을 찾은 뒤 ‘내 계정에 리딩 저장하기’를 눌러 주세요.</p> : null}
      <div className="collection-grid">{readings?.items.map(entry => <article className="saved-item" key={entry.id}><button disabled={busy} onClick={() => open(entry.id)}><span className="eyebrow">{entry.birthTimeUnknown ? "시간 모름 · 참고 리딩" : "MY STAR JOURNAL"}</span><h3>{entry.zenithStarName}</h3><p>{entry.constellationName}</p><p>{entry.summary}</p><span className="saved-open">리딩 펼쳐보기 →</span></button></article>)}</div>
      {readings && readings.total > 0 ? <Pagination page={page} total={readings.total} pageSize={12} onChange={setPage} busy={busy} /> : null}
      {profiles?.total ? <section className="profile-library"><h2 className="section-title">저장한 출생 프로필</h2><p className="help">저장된 시각·시간대·서머타임 설정으로 새 리딩을 만들어요.</p>{profiles.items.map(profile => <div key={profile.id} className="profile-row"><div><strong>{profile.label}</strong><p className="help">{profile.input.birthAtLocal.replace("T", " ")} · {profile.input.timezone}{profile.input.dstFold != null ? ` · ${profile.input.dstFold + 1}번째 시각` : ""}</p></div><button className="button secondary" disabled={busy} onClick={() => open(profile.id, true)}>이 정보로 리딩 만들고 저장</button></div>)}<Pagination page={profilePage} total={profiles.total} pageSize={12} onChange={setProfilePage} busy={busy} /></section> : null}
      {busy ? <p role="status" className="help">리딩을 준비하는 중이에요.</p> : null}
    </>}
  </section>;
}
export function Pagination({ page, total, pageSize, onChange, busy = false }: { page: number; total: number; pageSize: number; onChange: (page: number) => void; busy?: boolean }) {
  return <nav className="pagination" aria-label="페이지 이동"><button className="button secondary" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>이전</button><span>{page} / {Math.max(1, Math.ceil(total / pageSize))}</span><button className="button secondary" disabled={busy || page * pageSize >= total} onClick={() => onChange(page + 1)}>다음</button></nav>;
}
