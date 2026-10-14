"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";

export function AccountNavigation({ pathname }: { pathname: string }) {
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      const response = await authClient.signOut();
      if (response.error) throw new Error("Sign out failed");
      // Clear private profile data that may still be filled into client-side forms.
      window.location.assign("/readings/preview");
    } catch { setError("로그아웃하지 못했어요. 다시 시도해 주세요."); }
    finally { setSigningOut(false); }
  }
  return <nav className="account-navigation" aria-label="계정 메뉴">
    {isPending ? <span role="status">확인 중…</span> : session
      ? <button type="button" onClick={logout} disabled={signingOut} aria-busy={signingOut}>{signingOut ? "로그아웃 중…" : "로그아웃"}</button>
      : <Link href="/login">로그인</Link>}
    <span aria-hidden="true">·</span><Link href="/account" aria-current={pathname === "/account" ? "page" : undefined}>내 정보</Link>
    {error ? <p className="error account-navigation-error" role="alert">{error}</p> : null}
  </nav>;
}
