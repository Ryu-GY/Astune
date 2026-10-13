"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
import Link from "next/link";
import { apiClient } from "@/lib/utils/api-client";
import type { ReadingPreviewResponse } from "@/types/reading";
import { ReadingCard } from "./ReadingCard";

type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
type Entry = { id: string; zenithStarName: string; constellationName: string; summary: string; createdAt: string; birthTimeUnknown: boolean };
export function AccountReadings() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <p role="status" className="help">리딩을 불러오는 중이에요.</p>;
  if (!session) return <div className="account-intro"><p className="help">저장한 리딩을 확인하려면 로그인해 주세요.</p><Link className="button secondary" href="/login?next=/me/readings">로그인</Link></div>;
  return <ReadingLibrary key={session.user.id} />;
}
function ReadingLibrary() {
  const [page, setPage] = useState(1);
  const [readings, setReadings] = useState<Page<Entry> | null>(null);
  const [selected, setSelected] = useState<ReadingPreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setReadings(null); setError("");
    apiClient<Page<Entry>>(`/api/v1/me/readings?page=${page}&pageSize=12`, { signal: controller.signal })
      .then(items => { if (!controller.signal.aborted) setReadings(items); })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "보관함을 불러오지 못했어요."); });
    return () => controller.abort();
  }, [page, revision]);
  async function open(id: string) {
    setBusy(true); setError("");
    try {
      const result = await apiClient<{ preview: ReadingPreviewResponse }>(`/api/v1/readings/${id}`);
      setSelected(result.preview);
    } catch (error) { setError(error instanceof Error ? error.message : "리딩을 불러오지 못했어요."); }
    finally { setBusy(false); }
  }
  return <section aria-label="계정에 저장한 리딩">
    {error ? <div role="alert"><p className="error">{error}</p><button className="text-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div> : null}
    {selected ? <div className="saved-reading-view"><button className="text-button" onClick={() => setSelected(null)}>← 계정 보관함으로 돌아가기</button><ReadingCard key={JSON.stringify(selected.input)} data={selected} accountSaved /></div> : <>
      <h2 className="section-title">계정 리딩 {readings ? `· ${readings.total}개` : ""}</h2>
      {!readings && !error ? <p role="status">리딩을 불러오는 중이에요.</p> : null}
      {readings?.total === 0 ? <p className="help">아직 계정에 저장한 리딩이 없어요. 별을 찾은 뒤 ‘내 계정에 리딩 저장하기’를 눌러 주세요.</p> : null}
      <div className="collection-grid">{readings?.items.map(entry => <article className="saved-item" key={entry.id}><button disabled={busy} onClick={() => open(entry.id)}><span className="eyebrow">{entry.birthTimeUnknown ? "시간 모름 · 참고 리딩" : "MY STAR JOURNAL"}</span><h3>{entry.zenithStarName}</h3><p>{entry.constellationName}</p><p>{entry.summary}</p><span className="saved-open">리딩 펼쳐보기 →</span></button></article>)}</div>
      {readings && readings.total > 0 ? <Pagination page={page} total={readings.total} pageSize={12} onChange={setPage} busy={busy} /> : null}
      {busy ? <p role="status" className="help">리딩을 준비하는 중이에요.</p> : null}
    </>}
  </section>;
}
export function Pagination({ page, total, pageSize, onChange, busy = false }: { page: number; total: number; pageSize: number; onChange: (page: number) => void; busy?: boolean }) {
  return <nav className="pagination" aria-label="페이지 이동"><button className="button secondary" disabled={busy || page <= 1} onClick={() => onChange(page - 1)}>이전</button><span>{page} / {Math.max(1, Math.ceil(total / pageSize))}</span><button className="button secondary" disabled={busy || page * pageSize >= total} onClick={() => onChange(page + 1)}>다음</button></nav>;
}
