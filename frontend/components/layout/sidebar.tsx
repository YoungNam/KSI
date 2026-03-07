"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Search,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 네비게이션 항목 정의 (사이드바 + 모바일 하단바 공용) */
export const navItems = [
  {
    href: "/dashboard",
    label: "대시보드",
    icon: LayoutDashboard,
    description: "시장 현황 요약",
  },
  {
    href: "/strategy",
    label: "전략",
    icon: TrendingUp,
    description: "오늘의 투자 전략",
  },
  {
    href: "/stock",
    label: "종목 스캔",
    icon: Search,
    description: "특징주 발굴",
  },
  {
    href: "/watchlist",
    label: "관심 종목",
    icon: Star,
    description: "나의 관심 종목",
  },
];

interface SidebarProps {
  className?: string;
}

/**
 * KSI Toss 스타일 사이드바 네비게이션
 * - 배경: #0E1117 (최심층, 배경과 동일)
 * - 경계선: border-r 1px solid #242D3D
 * - 활성 항목: 좌측 3px 파란 바 + #161B27 배경
 * - 비활성 항목: #8B96A9 텍스트, hover 시 #161B27
 */
export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex flex-col w-60 min-h-screen",
        "bg-[#0E1117] border-r border-[#242D3D]",
        className
      )}
    >
      {/* 로고 / 서비스명 */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-[#242D3D]">
        {/* KSI 로고 — 파란 원형 배지 */}
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#3182F6] shadow-[0_0_12px_rgba(49,130,246,0.4)]">
          <span className="text-sm font-black text-white tracking-tight">
            K
          </span>
        </div>
        <div>
          <p className="text-sm font-bold text-[#F0F4FF] leading-none tracking-tight">
            KSI
          </p>
          <p className="text-[11px] text-[#6B7A8D] mt-0.5 leading-none">
            Korean Stock Intelligence
          </p>
        </div>
      </div>

      {/* 네비게이션 메뉴 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          // 현재 경로와 일치하면 활성화 스타일 적용
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-all duration-150",
                isActive
                  ? [
                      // 활성: 파란 좌측 바 + 밝은 배경
                      "bg-[#161B27] text-[#F0F4FF] font-medium",
                      "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
                      "before:h-5 before:w-[3px] before:rounded-r-full before:bg-[#3182F6]",
                    ].join(" ")
                  : // 비활성: muted 텍스트, hover 시 약한 배경
                    "text-[#A0AEBF] hover:bg-[#161B27]/60 hover:text-[#F0F4FF]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0 transition-colors duration-150",
                  isActive ? "text-[#3182F6]" : "text-[#6B7A8D]"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* 하단 버전 정보 */}
      <div className="px-5 py-4 border-t border-[#242D3D]">
        <p className="text-[11px] text-[#6B7A8D]">KOSPI · KOSDAQ 분석</p>
        <p className="text-[11px] text-[#6B7A8D] mt-0.5">
          v0.1.0 — 개발중
        </p>
      </div>
    </aside>
  );
}
