import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Noto_Serif_KR } from "next/font/google";
import { SiteNavigation } from "@/components/SiteNavigation";
import { Icon } from "@/components/ui/Icon";
import Link from "next/link";

const editorial = Noto_Serif_KR({ weight: ["400", "500"], subsets: ["latin"], display: "swap", variable: "--font-editorial" });
const display = Cormorant_Garamond({ weight: ["400", "500"], subsets: ["latin"], display: "swap", variable: "--font-display" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f5ee"
};

export const metadata: Metadata = {
  title: "Astune — 당신의 별을 만나다",
  description: "태어난 순간, 당신의 하늘 가장 높은 곳에 있던 별. 출생 시각과 장소로 나의 대표 별과 네 가지 이야기를 만나보세요.",
  appleWebApp: { capable: true, title: "Astune", statusBarStyle: "default" },
  formatDetection: { telephone: false }
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${editorial.variable} ${display.variable}`}>
      <body>
        <a href="#main-content" className="skip-link">본문으로 바로가기</a>
        <SiteNavigation />
        <main id="main-content" className="container page">{children}</main>
        <footer className="site-footer container"><Link href="/" className="footer-brand">Astune</Link><span className="footer-motto">MAY YOUR STAR ALWAYS SHINE</span><p>해석은 상징적 리딩입니다.</p><Icon name="star" /></footer>
      </body>
    </html>
  );
}
