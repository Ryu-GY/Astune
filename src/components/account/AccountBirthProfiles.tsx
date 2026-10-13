"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { apiClient } from "@/lib/utils/api-client";
import type { BirthProfile, BirthProfilePage } from "@/types/birth-profile";
import { BirthProfileForm } from "./BirthProfileForm";
import { Pagination } from "@/components/reading/AccountReadings";

export function AccountBirthProfiles() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending) return <p className="help" role="status">출생 정보를 불러오는 중이에요.</p>;
  if (!session) return <div className="account-intro"><p>로그인하면 출생 정보를 저장하고 별을 찾을 때 바로 사용할 수 있어요.</p><Link className="button" href="/login?next=/account">로그인하고 출생 정보 저장하기</Link></div>;
  return <ProfileLibrary key={session.user.id} />;
}
function ProfileLibrary() {
  const [profiles, setProfiles] = useState<BirthProfilePage | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState<BirthProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setProfiles(null); setError("");
    apiClient<BirthProfilePage>(`/api/v1/birth-profiles?page=${page}&pageSize=12`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setProfiles(data); })
      .catch(caught => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "출생 정보를 불러오지 못했어요."); });
    return () => controller.abort();
  }, [page, revision]);
  function onSaved(profile: BirthProfile) {
    setSaved(profile); setEditing(false); setPage(1); setRevision(value => value + 1);
  }
  return <>
    {saved ? <div className="profile-saved-notice" role="status"><p>‘{saved.label}’을 저장했어요.</p><Link className="button" href={`/readings/preview?birthProfileId=${encodeURIComponent(saved.id)}`}>저장한 정보로 별 찾기</Link></div> : null}
    {error ? <div role="alert"><p className="error">{error}</p><button className="text-button" onClick={() => setRevision(value => value + 1)}>다시 불러오기</button></div> : null}
    <section className="profile-library" aria-label="저장한 출생 정보">
      <h2 className="section-title">저장한 출생 정보{profiles ? ` · ${profiles.total}개` : ""}</h2>
      {!profiles && !error ? <p className="help" role="status">불러오는 중이에요.</p> : null}
      {profiles?.total === 0 ? <p className="help">출생 정보를 한 번 저장하면 매번 입력하지 않아도 돼요.</p> : null}
      {profiles?.items.map(profile => <div className="profile-row" key={profile.id}>
        <div><strong>{profile.label}</strong><p className="help">{profile.input.birthAtLocal.replace("T", " ")}<br />{profile.input.locationName} · {profile.input.timezone}{profile.input.dstFold != null ? ` · ${profile.input.dstFold + 1}번째 시각` : ""}</p></div>
        <Link className="button secondary" href={`/readings/preview?birthProfileId=${encodeURIComponent(profile.id)}`}>이 정보로 별 찾기</Link>
      </div>)}
      {profiles && profiles.total > 12 ? <Pagination page={page} total={profiles.total} pageSize={12} onChange={setPage} /> : null}
    </section>
    {editing || profiles?.total === 0 ? <section className="profile-editor"><h2 className="section-title">출생 정보 추가</h2><BirthProfileForm onSaved={onSaved} />{profiles?.total ? <button className="text-button" onClick={() => setEditing(false)}>취소</button> : null}</section>
      : <button className="button secondary" onClick={() => { setEditing(true); setSaved(null); }}>출생 정보 추가하기</button>}
  </>;
}
