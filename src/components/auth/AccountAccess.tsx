"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";

export function AccountAccess({ callbackURL = "/me/readings", guestLink = true }: { callbackURL?: string; guestLink?: boolean }) {
  const { data, isPending } = authClient.useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login() {
    setBusy(true); setError("");
    try {
      const response = await authClient.signIn.social({ provider: "google", callbackURL, errorCallbackURL: "/login?error=google" });
      if (response.error) throw new Error("Google 로그인에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "로그인에 실패했어요."); }
    finally { setBusy(false); }
  }
  return <div className="account-access">
    {isPending ? <p className="help" role="status">로그인 상태 확인 중</p> : data ? <>
      <Link className="button secondary" href="/account">내 출생 정보 관리하기</Link>
    </> : <>
      <button className="button google-login" disabled={busy} onClick={login}><span aria-hidden="true">G</span>{busy ? "Google로 연결 중" : "Google 계정으로 계속하기"}</button>
      <p className="help">처음이라면 Google 로그인과 함께 계정이 만들어져요.</p>
      {guestLink ? <Link className="button secondary" href="/readings/preview">게스트로 시작하기</Link> : null}
    </>}
    {error ? <p className="error" role="alert">{error}</p> : null}
  </div>;
}
