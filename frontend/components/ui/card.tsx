import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * KSI Toss 스타일 카드 컨테이너
 * - rounded-2xl (16px), border #242D3D, bg #161B27
 * - shadow: 0 2px 12px rgba(0,0,0,0.3)
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-2xl border border-[#242D3D] bg-[#161B27] text-[#F0F4FF]",
      "shadow-[0_2px_12px_rgba(0,0,0,0.3)]",
      "transition-colors duration-150",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

/** 카드 헤더 — 컴팩트 패딩으로 레이블 영역 최소화 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1 p-6 pb-2", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

/**
 * 카드 제목 — Toss 스타일 레이블
 * 작은 폰트, muted 색상으로 계층 구분
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xs font-medium text-[#A0AEBF] uppercase tracking-wide leading-none",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

/** 카드 설명 텍스트 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-[#A0AEBF]", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

/** 카드 본문 — 기본 패딩 유지 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

/** 카드 푸터 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

/**
 * CardValue — Toss 스타일 주요 수치 표시
 * 큰 폰트 + tabular-nums 으로 가격/지수 강조
 */
const CardValue = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-3xl font-bold tabular-nums text-[#F0F4FF] leading-tight",
      className
    )}
    {...props}
  />
));
CardValue.displayName = "CardValue";

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardValue,
};
