"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
const items: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "홈", icon: "home" },
  { href: "/readings/preview", label: "별 찾기", icon: "star" },
  { href: "/me/readings", label: "내 리딩", icon: "book" },
];
export function SiteNavigation() {
  const pathname = usePathname();
  return <>
    <header className="site-header container">
      <Link href="/" className="brand" aria-label="Astune 홈">Astune<Icon name="star" /></Link>
      <nav className="desktop-nav" aria-label="주 메뉴">{items.slice(1).map(item => <Link key={item.href} href={item.href} className={(pathname === item.href || (item.href === "/readings/preview" && pathname === "/")) ? "active" : ""} aria-current={pathname === item.href ? "page" : undefined}>{item.label}</Link>)}</nav>
      <p className="header-note"><Icon name="star" />당신의 순간이, 하나의 별이 되어</p>
      <span className="mobile-header-note">A STAR OF YOUR OWN</span>
    </header>
    <nav className="mobile-nav" aria-label="모바일 주 메뉴">{items.map(item => <Link key={item.href} href={item.href} className={pathname === item.href ? "active" : ""} aria-current={pathname === item.href ? "page" : undefined}><Icon name={item.icon} /><span>{item.label}</span></Link>)}</nav>
  </>;
}
