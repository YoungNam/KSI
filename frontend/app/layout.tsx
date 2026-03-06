import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

/** KSI 앱 메타데이터 */
export const metadata: Metadata = {
  title: "KSI — Korean Stock Intelligence",
  description: "KOSPI·KOSDAQ 개인화 AI 투자 컨설팅 서비스",
  keywords: ["주식", "KOSPI", "KOSDAQ", "투자", "AI", "분석"],
};

/**
 * KSI 루트 레이아웃
 * - 사이드바 + 메인 콘텐츠 영역으로 구성
 * - 다크 테마 기본 적용
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          {/* 사이드바 — 데스크탑에서 고정, 모바일에서 숨김 */}
          <div className="hidden md:flex">
            <Sidebar />
          </div>

          {/* 메인 콘텐츠 영역 */}
          <main className="flex-1 overflow-auto">
            {/* 모바일 상단 헤더 */}
            <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
              <span className="text-sm font-bold text-primary">KSI</span>
              <span className="text-xs text-muted-foreground">
                Korean Stock Intelligence
              </span>
            </div>

            {/* 페이지 콘텐츠 */}
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
