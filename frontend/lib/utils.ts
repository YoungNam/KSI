import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스 병합 유틸리티 (shadcn/ui 표준)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 숫자를 한국식 천단위 포맷으로 변환
 * 예: 1234567 → "1,234,567"
 */
export function formatNumber(value: number, decimals = 0): string {
  return value.toLocaleString("ko-KR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 등락률 포맷 (+/- 부호 포함)
 * 예: 1.23 → "+1.23%", -0.5 → "-0.50%"
 */
export function formatChange(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * 등락에 따른 Toss 텍스트 색상 클래스 반환
 * - 상승: #05C075 (Toss Green)
 * - 하락: #F04452 (Toss Red)
 * - 중립: #8B96A9 (muted)
 */
export function getChangeColor(value: number): string {
  if (value > 0) return "text-[#05C075]";
  if (value < 0) return "text-[#F04452]";
  return "text-[#A0AEBF]";
}

/**
 * 날짜 문자열을 한국어 포맷으로 변환
 * 예: "2024-01-15T09:30:00" → "2024년 1월 15일 09:30"
 */
export function formatDateKo(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 시장 국면(phase)에 따른 Toss 색상 반환
 * - 강세: #05C075 (Green), badge variant "bullish"
 * - 약세: #F04452 (Red), badge variant "bearish"
 * - 횡보/중립: #F5A623 (Amber), badge variant "neutral"
 */
export function getPhaseColor(
  phase: string
): { badge: string; text: string; bg: string; variant: "bullish" | "bearish" | "neutral" } {
  const p = phase?.toLowerCase() ?? "";
  if (p.includes("강세") || p.includes("bull")) {
    return {
      badge: "bg-[#05C075]/10 text-[#05C075] border-[#05C075]/20",
      text: "text-[#05C075]",
      bg: "bg-[#05C075]",
      variant: "bullish",
    };
  }
  if (p.includes("약세") || p.includes("bear")) {
    return {
      badge: "bg-[#F04452]/10 text-[#F04452] border-[#F04452]/20",
      text: "text-[#F04452]",
      bg: "bg-[#F04452]",
      variant: "bearish",
    };
  }
  // 횡보 / 중립
  return {
    badge: "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20",
    text: "text-[#F5A623]",
    bg: "bg-[#F5A623]",
    variant: "neutral",
  };
}

/**
 * 매수/매도/관망 방향에 따른 Toss 배지 색상 반환
 */
export function getActionColor(action: string): string {
  const a = action?.toLowerCase() ?? "";
  if (a.includes("매수") || a.includes("buy")) {
    return "bg-[#05C075]/10 text-[#05C075] border-[#05C075]/20";
  }
  if (a.includes("매도") || a.includes("sell")) {
    return "bg-[#F04452]/10 text-[#F04452] border-[#F04452]/20";
  }
  // 관망
  return "bg-[#F5A623]/10 text-[#F5A623] border-[#F5A623]/20";
}

/**
 * 수급 금액을 조/억 단위로 포맷
 * 예: 8500000000000 → "8.5조", 234500000000 → "2,345억"
 */
export function formatFlow(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  if (abs >= 1_000_000_000_000) {
    // 1조 이상
    return `${sign}${(abs / 1_000_000_000_000).toFixed(1)}조`;
  }
  if (abs >= 100_000_000) {
    // 1억 이상
    return `${sign}${Math.round(abs / 100_000_000).toLocaleString("ko-KR")}억`;
  }
  return `${sign}${abs.toLocaleString("ko-KR")}`;
}
