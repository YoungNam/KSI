import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-nav";

/** KSI 앱 메타데이터 */
export const metadata: Metadata = {
  title: "KSI — Korean Stock Intelligence",
  description: "KOSPI·KOSDAQ 개인화 AI 투자 컨설팅 서비스",
  keywords: ["주식", "KOSPI", "KOSDAQ", "투자", "AI", "분석"],
};

/** 모바일 뷰포트 — safe-area 대응 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * KSI 루트 레이아웃
 * - 데스크탑: 좌측 사이드바 + 메인 콘텐츠
 * - 모바일: 상단 헤더 + 콘텐츠 + 하단 탭 바
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
            <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-[#0E1117]/95 backdrop-blur-lg sticky top-0 z-40">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#3182F6] shadow-[0_0_8px_rgba(49,130,246,0.3)]">
                <span className="text-xs font-black text-white">K</span>
              </div>
              <div>
                <span className="text-sm font-bold text-[#F0F4FF]">KSI</span>
                <span className="text-[10px] text-[#6B7A8D] ml-2">
                  Korean Stock Intelligence
                </span>
              </div>
            </div>

            {/* 페이지 콘텐츠 — 모바일 하단 탭 바 공간 확보 */}
            <div className="p-4 md:p-6 pb-20 md:pb-6">{children}</div>
          </main>
        </div>

        {/* 모바일 하단 탭 바 */}
        <MobileBottomNav />
      </body>
    </html>
  );
}
