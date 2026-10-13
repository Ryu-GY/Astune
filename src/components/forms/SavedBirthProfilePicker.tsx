"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { apiClient } from "@/lib/utils/api-client";
import type { BirthProfile, BirthProfilePage } from "@/types/birth-profile";

type Props = { initialId?: string; autoSelectFirst?: boolean; onSelect: (profile: BirthProfile, source?: "initial" | "manual") => void; disabled: boolean };
export function SavedBirthProfilePicker(props: Props) {
  const { data: session } = authClient.useSession();
  if (!session) return null;
  return <ProfilePicker key={session.user.id} {...props} />;
}
function ProfilePicker({ initialId, autoSelectFirst = false, onSelect, disabled }: Props) {
  const [data, setData] = useState<BirthProfilePage | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<BirthProfile | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const autoSelected = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    setData(null); setError("");
    apiClient<BirthProfilePage>(`/api/v1/birth-profiles?page=${page}&pageSize=12`, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "출생 정보를 불러오지 못했어요."); });
    return () => controller.abort();
  }, [page, revision]);
  useEffect(() => {
    if (!autoSelectFirst || initialId || !data || autoSelected.current) return;
    autoSelected.current = true;
    if (data.items[0]) { setSelected(data.items[0]); onSelect(data.items[0], "initial"); }
  }, [autoSelectFirst, initialId, data, onSelect]);
  useEffect(() => {
    if (!initialId) return;
    const controller = new AbortController();
    setLoading(true);
    apiClient<{ birthProfile: BirthProfile }>(`/api/v1/birth-profiles/${encodeURIComponent(initialId)}`, { signal: controller.signal })
      .then(({ birthProfile }) => { if (!controller.signal.aborted) { setSelected(birthProfile); onSelect(birthProfile, "initial"); } })
      .catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "출생 정보를 불러오지 못했어요."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialId, onSelect, revision]);
  return <div className="saved-profile-picker">
    <div className="saved-profile-heading"><label className="label" htmlFor="saved-profile">저장한 출생 정보</label><Link href="/account">관리</Link></div>
    {error ? <div role="alert"><p className="error">{error}</p><button className="text-button" type="button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div> : null}
    {((!data && !error) || loading) ? <p className="help" role="status">출생 정보를 불러오는 중이에요.</p> : null}
    {data?.total === 0 ? <p className="help"><Link href="/account">내 정보에서 출생 정보를 저장</Link>하면 바로 불러올 수 있어요.</p> : data ? <>
      <div className="profile-picker-controls"><select id="saved-profile" className="select" value={selected?.id ?? ""} disabled={disabled || loading} onChange={event => setSelected(data.items.find(profile => profile.id === event.target.value) ?? null)}>
        <option value="">출생 정보를 선택해 주세요</option>
        {selected && !data.items.some(item => item.id === selected.id) ? <option value={selected.id}>{selected.label}</option> : null}
        {data.items.map(profile => <option key={profile.id} value={profile.id}>{profile.label} · {profile.input.birthAtLocal.split("T")[0]}</option>)}
      </select><button className="button secondary" type="button" disabled={disabled || loading || !selected} onClick={() => { if (selected) onSelect(selected, "manual"); }}>불러오기</button></div>
      {data.total > 12 ? <div className="profile-picker-pagination"><button type="button" disabled={disabled || page === 1} onClick={() => setPage(value => value - 1)}>이전</button><span>{page} / {Math.ceil(data.total / 12)}</span><button type="button" disabled={disabled || page * 12 >= data.total} onClick={() => setPage(value => value + 1)}>다음</button></div> : null}
    </> : null}
  </div>;
}
