import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * KSI Toss 스타일 배지 변형 정의
 * - border-radius: 8px
 * - padding: 2px 8px
 * - font-size: 12px, font-weight: 600
 */
const badgeVariants = cva(
  "inline-flex items-center rounded-[8px] border px-2 py-0.5 text-xs font-semibold transition-colors duration-150 whitespace-nowrap",
  {
    variants: {
      variant: {
        // 기본 — Primary Blue
        default:
          "bg-[#3182F6]/15 text-[#3182F6] border-[#3182F6]/25",
        // Secondary — muted 톤
        secondary:
          "bg-[#1E2535] text-[#A0AEBF] border-[#242D3D]",
        // Outline — 테두리만
        outline:
          "bg-transparent text-[#F0F4FF] border-[#242D3D]",
        // Primary 강조
        primary:
          "bg-[#3182F6]/15 text-[#3182F6] border-[#3182F6]/25",

        // --- Toss 색상 시스템 ---
        // 상승 / 매수 — Toss Green
        rise:
          "bg-[#05C075]/10 text-[#05C075] border-[#05C075]/20",
        // 하락 / 매도 — Toss Red
        fall:
          "bg-[#F04452]/10 text-[#F04452] border-[#F04452]/20",
        // 중립 / 관망 — Toss Amber
        neutral:
          "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",

        // --- KSI 도메인 전용 ---
        // 강세장
        bullish:
          "bg-[#05C075]/10 text-[#05C075] border-[#05C075]/20",
        // 약세장
        bearish:
          "bg-[#F04452]/10 text-[#F04452] border-[#F04452]/20",
        // 매수 신호
        buy:
          "bg-[#05C075]/10 text-[#05C075] border-[#05C075]/20",
        // 매도 신호
        sell:
          "bg-[#F04452]/10 text-[#F04452] border-[#F04452]/20",
        // 관망 / 대기
        watch:
          "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
        // 위험/주의
        destructive:
          "bg-[#F04452]/10 text-[#F04452] border-[#F04452]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/** KSI Toss 스타일 배지 컴포넌트 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
