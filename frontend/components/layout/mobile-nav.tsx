"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navItems } from "./sidebar";

/**
 * 모바일 하단 탭 바 — Toss 스타일
 * - 하단 고정, safe-area 대응 (노치/홈 인디케이터)
 * - 5개 탭 아이콘 + 레이블
 * - 활성 탭: Toss Blue 아이콘 + 텍스트
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 md:hidden",
        "bg-[#0E1117]/95 backdrop-blur-lg",
        "border-t border-[#242D3D]",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full",
                "transition-colors duration-150 active:scale-95",
                isActive
                  ? "text-[#3182F6]"
                  : "text-[#6B7A8D] active:text-[#A0AEBF]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
