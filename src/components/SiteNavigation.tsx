"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { Icon, type IconName } from "@/components/ui/Icon";
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/readings/preview", label: "별 찾기", icon: "star" },
  { href: "/horoscope", label: "오늘의 운세", icon: "sun" },
  { href: "/me/readings", label: "내 리딩", icon: "book" },
];
export function SiteNavigation() {
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  async function logout() {
    setSigningOut(true); setError("");
    try {
      const response = await authClient.signOut();
      if (response.error) throw new Error("로그아웃하지 못했어요. 다시 시도해 주세요.");
      // A fresh document also clears any private profile currently filled in the form.
      window.location.assign("/readings/preview");
    } catch { setError("로그아웃하지 못했어요. 다시 시도해 주세요."); }
    finally { setSigningOut(false); }
  }
  return <>
    <header className="site-header container">
      <Link href="/" className="brand" aria-label="Astune 홈">Astune<Icon name="star" /></Link>
      <nav className="desktop-nav" aria-label="주 메뉴">{items.slice(1).map(item => <Link key={item.href} href={item.href} className={(pathname === item.href || (item.href === "/readings/preview" && pathname === "/")) ? "active" : ""} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}</nav>
      <nav className="account-navigation" aria-label="계정 메뉴">
        {isPending ? <span role="status">확인 중…</span> : session
          ? <button type="button" onClick={logout} disabled={signingOut}>{signingOut ? "로그아웃 중…" : "로그아웃"}</button>
          : <Link href="/login">로그인</Link>}
        <span aria-hidden="true">·</span><Link href="/account" aria-current={pathname === "/account" ? "page" : undefined}>내 정보</Link>
        {error ? <p className="error account-navigation-error" role="alert">{error}</p> : null}
      </nav>
    </header>
    <nav className="mobile-nav" aria-label="모바일 주 메뉴">{items.map(item => <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""} aria-current={pathname === item.href ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>
  </>;
}
