import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Astune",
  description: "출생 시각의 천정성으로 읽는 별 리딩 서비스"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container row-between">
            <a href="/" className="brand">
              Astune
            </a>
            <nav className="nav">
              <a href="/readings/preview">리딩 미리보기</a>
              <a href="/me/readings">내 리딩</a>
              <a href="/admin/rule-versions">관리자</a>
            </nav>
          </div>
        </header>
        <main className="container page">{children}</main>
      </body>
    </html>
  );
}
