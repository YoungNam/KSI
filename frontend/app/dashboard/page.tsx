"use client";

import React from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Wifi,
  WifiOff,
  Activity,
  DollarSign,
  Droplets,
  CircleDot,
} from "lucide-react";
import {
  Card,
  CardValue,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMarketRealtime } from "@/hooks/useMarketRealtime";
import {
  formatNumber,
  formatChange,
  getChangeColor,
  getPhaseColor,
  formatDateKo,
} from "@/lib/utils";
import { WatchlistSection } from "@/components/watchlist-section";

/* ────────────────────────────────────────────────────────────
   로딩 스켈레톤 — 펄스 애니메이션
   ──────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-[#242D3D] bg-[#161B27] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      {/* 레이블 영역 */}
      <div className="h-3 bg-[#1E2535] rounded-full w-20 animate-pulse mb-4" />
      {/* 수치 영역 */}
      <div className="h-9 bg-[#1E2535] rounded-lg w-36 animate-pulse mb-3" />
      {/* 등락 영역 */}
      <div className="h-4 bg-[#1E2535] rounded-full w-28 animate-pulse" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   지수 카드 — KOSPI / KOSDAQ
   큰 숫자 중심 Toss 레이아웃
   ──────────────────────────────────────────────────────────── */
function IndexCard({
  label,
  value,
  change,
  volume,
}: {
  label: string;
  value: number;
  change: number;
  volume?: string;   // 백엔드에서 이미 포맷된 문자열 ("8.5조")
}) {
  const colorClass = getChangeColor(change);
  const TrendIcon =
    change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <Card className="p-6 hover:border-[#3182F6]/40 transition-colors duration-200">
      {/* 레이블 */}
      <p className="text-xs font-medium text-[#A0AEBF] uppercase tracking-wide mb-3">
        {label}
      </p>
      {/* 주요 수치 — 지수값 */}
      <CardValue className="mb-2 text-4xl">{formatNumber(value, 2)}</CardValue>
      {/* 등락 */}
      <div className={`flex items-center gap-1.5 ${colorClass}`}>
        <TrendIcon className="w-4 h-4 flex-shrink-0" />
        <span className="text-base font-semibold tabular-nums">
          {formatChange(change)}
        </span>
      </div>
      {/* 거래대금 (있을 때만 표시) */}
      {volume !== undefined && volume !== "—" && (
        <p className="text-xs text-[#6B7A8D] mt-3 tabular-nums">
          거래대금{" "}
          <span className="text-[#A0AEBF]">{volume}</span>
        </p>
      )}
      {/* 상승/하락 배경 인디케이터 */}
      <div
        className={[
          "absolute inset-x-0 bottom-0 h-0.5 rounded-b-2xl",
          isPositive
            ? "bg-[#05C075]"
            : isNegative
            ? "bg-[#F04452]"
            : "bg-[#A0AEBF]",
        ].join(" ")}
        aria-hidden
      />
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   수급 카드 — 외국인 / 기관 순매수
   ──────────────────────────────────────────────────────────── */
function FlowCard({ label, value }: { label: string; value: string }) {
  // 문자열 부호로 색상·아이콘 결정 ("+" → 상승, "-" → 하락, "—" → 중립)
  const isPositive = value.startsWith("+");
  const isNegative = value.startsWith("-");
  const colorClass = isPositive
    ? "text-[#05C075]"
    : isNegative
    ? "text-[#F04452]"
    : "text-[#A0AEBF]";
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <Card className="p-6 hover:border-[#3182F6]/40 transition-colors duration-200">
      {/* 레이블 */}
      <p className="text-xs font-medium text-[#A0AEBF] uppercase tracking-wide mb-3">
        {label} 순매수
      </p>
      {/* 수급 금액 */}
      <div className={`flex items-center gap-2 ${colorClass}`}>
        <TrendIcon className="w-5 h-5 flex-shrink-0" />
        <span className="text-3xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-xs text-[#6B7A8D] mt-2">KOSPI + KOSDAQ 합산</p>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   시장 점수 게이지 — Recharts RadialBarChart
   반원형 게이지 + 중앙 점수 오버레이
   ──────────────────────────────────────────────────────────── */
function MarketScoreGauge({ score }: { score: number }) {
  // 점수 구간에 따른 Toss 색상 결정
  const gaugeColor =
    score >= 70 ? "#05C075" : score >= 40 ? "#F5A623" : "#F04452";

  const data = [{ name: "점수", value: score, fill: gaugeColor }];

  return (
    <div className="relative w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="72%"
          innerRadius="62%"
          outerRadius="88%"
          startAngle={180}
          endAngle={0}
          data={data}
        >
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            dataKey="value"
            cornerRadius={8}
            background={{ fill: "#1E2535" }}
            angleAxisId={0}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      {/* 중앙 점수 텍스트 오버레이 */}
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-5">
        <span
          className="text-5xl font-bold tabular-nums leading-none"
          style={{ color: gaugeColor }}
        >
          {score}
        </span>
        <span className="text-xs text-[#A0AEBF] mt-1.5 font-medium">
          / 100
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   시장 점수 + 국면 통합 카드
   ──────────────────────────────────────────────────────────── */
function MarketScoreCard({
  score,
  phase,
  stance,
  indicators,
  generatedAt,
}: {
  score: number;
  phase: string;
  stance: string;
  indicators: Record<string, unknown>;
  generatedAt?: string;
}) {
  const phaseColors = getPhaseColor(phase);

  return (
    <Card className="p-6">
      {/* 헤더 */}
      <p className="text-xs font-medium text-[#A0AEBF] uppercase tracking-wide mb-4">
        시장 점수
      </p>

      {/* 게이지 */}
      <MarketScoreGauge score={score} />

      {/* 국면 + 스탠스 배지 */}
      <div className="flex flex-wrap gap-2 mt-4">
        <Badge className={phaseColors.badge} variant="outline">
          {phase}
        </Badge>
        <Badge variant="secondary">{stance}</Badge>
      </div>

      {/* 기술 지표 그리드 */}
      {indicators && Object.entries(indicators).length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#242D3D]">
          <p className="text-xs text-[#6B7A8D] font-medium mb-3">기술 지표</p>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
            {Object.entries(indicators)
              .slice(0, 6)
              .map(([key, val]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-xs text-[#A0AEBF]">{key}</span>
                  <span className="text-xs font-semibold text-[#F0F4FF] tabular-nums">
                    {typeof val === "number" ? formatNumber(val, 2) : String(val)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 분석 시각 */}
      {generatedAt && (
        <p className="text-[11px] text-[#6B7A8D] mt-3">
          분석 {formatDateKo(generatedAt)}
        </p>
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   시장 국면 카드
   ──────────────────────────────────────────────────────────── */
function MarketPhaseCard({
  phase,
  stance,
}: {
  phase: string;
  stance: string;
}) {
  const colors = getPhaseColor(phase);

  return (
    <Card className="p-6">
      <p className="text-xs font-medium text-[#A0AEBF] uppercase tracking-wide mb-4">
        시장 국면
      </p>

      {/* 국면명 — 큰 텍스트 강조 */}
      <p className={`text-2xl font-bold mb-1 ${colors.text}`}>{phase}</p>
      <Badge className={colors.badge} variant="outline">
        {phase}
      </Badge>

      {/* 투자 스탠스 */}
      <div className="mt-4 pt-4 border-t border-[#242D3D]">
        <p className="text-xs text-[#A0AEBF] mb-1">투자 스탠스</p>
        <p className="text-sm font-semibold text-[#F0F4FF]">{stance}</p>
      </div>
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   시장 지표 카드 — 거래량 + 기술 지표
   ──────────────────────────────────────────────────────────── */
function MarketIndicatorsCard({
  kospiVolume,
  kosdaqVolume,
  indicators,
}: {
  kospiVolume: string;   // 예: "8.5조"
  kosdaqVolume: string;  // 예: "5.2조"
  indicators: Record<string, unknown>;
}) {
  return (
    <Card className="p-6">
      <p className="text-xs font-medium text-[#A0AEBF] uppercase tracking-wide mb-4">
        시장 지표
      </p>

      {/* 거래량 */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#A0AEBF]">KOSPI 거래대금</span>
          <span className="text-sm font-semibold text-[#F0F4FF] tabular-nums">
            {kospiVolume}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#A0AEBF]">KOSDAQ 거래대금</span>
          <span className="text-sm font-semibold text-[#F0F4FF] tabular-nums">
            {kosdaqVolume}
          </span>
        </div>
      </div>

      {/* 기술 지표 */}
      {indicators && Object.entries(indicators).length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#242D3D] space-y-2.5">
          <p className="text-xs text-[#6B7A8D] font-medium">기술 지표</p>
          {Object.entries(indicators)
            .slice(0, 4)
            .map(([key, val]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs text-[#A0AEBF]">{key}</span>
                <span className="text-xs font-semibold text-[#F0F4FF] tabular-nums">
                  {typeof val === "number" ? formatNumber(val, 2) : String(val)}
                </span>
              </div>
            ))}
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   글로벌 시장 미니 카드
   ──────────────────────────────────────────────────────────── */
function GlobalMiniCard({
  label,
  value,
  change,
  prefix,
  decimals = 2,
  icon: Icon,
}: {
  label: string;
  value: number;
  change: number;
  prefix?: string;
  decimals?: number;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const isEmpty = value === 0;
  const colorClass = getChangeColor(change);
  const TrendIcon =
    change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus;

  return (
    <Card className="p-4 hover:border-[#3182F6]/40 transition-colors duration-200">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-[#6B7A8D]" />}
        <p className="text-xs font-medium text-[#A0AEBF] uppercase tracking-wide">
          {label}
        </p>
      </div>
      <CardValue className="text-2xl mb-1">
        {isEmpty ? "—" : `${prefix ?? ""}${formatNumber(value, decimals)}`}
      </CardValue>
      {!isEmpty && (
        <div className={`flex items-center gap-1 ${colorClass}`}>
          <TrendIcon className="w-3 h-3 flex-shrink-0" />
          <span className="text-xs font-semibold tabular-nums">
            {formatChange(change)}
          </span>
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────
   글로벌 시장 섹션
   ──────────────────────────────────────────────────────────── */
function GlobalMarketSection({
  data,
}: {
  data: {
    sp500_price: number;
    sp500_change: number;
    nasdaq_price: number;
    nasdaq_change: number;
    usd_krw: number;
    usd_krw_change: number;
    wti_price: number;
    wti_change: number;
    gold_price: number;
    gold_change: number;
    us10y_yield: number;
  };
}) {
  // 환율 변동은 절대값(원), 등락률로 변환
  const usdChangePct =
    data.usd_krw > 0 ? (data.usd_krw_change / data.usd_krw) * 100 : 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[#6B7A8D] uppercase tracking-wide px-1">
        글로벌 시장
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <GlobalMiniCard
          label="S&P 500"
          value={data.sp500_price}
          change={data.sp500_change}
          decimals={0}
        />
        <GlobalMiniCard
          label="NASDAQ"
          value={data.nasdaq_price}
          change={data.nasdaq_change}
          decimals={0}
        />
        <GlobalMiniCard
          label="USD/KRW"
          value={data.usd_krw}
          change={usdChangePct}
          prefix="₩"
          decimals={0}
          icon={DollarSign}
        />
        <GlobalMiniCard
          label="WTI"
          value={data.wti_price}
          change={data.wti_change}
          prefix="$"
          icon={Droplets}
        />
        <GlobalMiniCard
          label="Gold"
          value={data.gold_price}
          change={data.gold_change}
          prefix="$"
          decimals={0}
          icon={CircleDot}
        />
        <GlobalMiniCard
          label="US 10Y"
          value={data.us10y_yield}
          change={0}
          decimals={2}
        />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   에러 배너
   ──────────────────────────────────────────────────────────── */
function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[#F04452]/30 bg-[#F04452]/10 px-4 py-3 text-sm text-[#F04452]">
      {message}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   대시보드 메인 페이지
   - useMarketRealtime 훅으로 Supabase Realtime 자동 갱신
   - Toss 금융 앱 스타일: 큰 숫자 중심 레이아웃
   ──────────────────────────────────────────────────────────── */
export default function DashboardPage() {
  const { data, loading, error, lastUpdated, realtimeConnected, refresh } =
    useMarketRealtime();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── 페이지 헤더 ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#F0F4FF] leading-tight">
            시장 현황
          </h1>
          <p className="text-sm text-[#A0AEBF] mt-0.5">
            KOSPI · KOSDAQ · 글로벌 실시간 대시보드
          </p>
        </div>

        {/* 우측 컨트롤 영역 */}
        <div className="flex items-center gap-3">
          {/* Realtime 연결 상태 표시 */}
          <div
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium",
              realtimeConnected
                ? "border-[#05C075]/25 bg-[#05C075]/10 text-[#05C075]"
                : "border-[#242D3D] bg-[#1E2535] text-[#A0AEBF]",
            ].join(" ")}
          >
            {realtimeConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">실시간</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">연결 중</span>
              </>
            )}
          </div>

          {/* 마지막 갱신 시각 */}
          {lastUpdated && (
            <span className="text-xs text-[#6B7A8D] hidden md:flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {lastUpdated.toLocaleTimeString("ko-KR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
          )}

          {/* 수동 새로고침 버튼 */}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>
        </div>
      </div>

      {/* ── 에러 배너 ── */}
      {error && <ErrorBanner message={error} />}

      {/* ── 초기 로딩 스켈레톤 ── */}
      {loading && !data && (
        <div className="space-y-6">
          {/* 1행 스켈레톤 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          {/* 2행 스켈레톤 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          {/* 3행 스켈레톤 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      )}

      {/* ── 데이터 표시 ── */}
      {data && (
        <div className="space-y-4">
          {/* ── 1행: KOSPI / KOSDAQ 지수 카드 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              <IndexCard
                label="KOSPI"
                value={data.kospi_index}
                change={data.kospi_change}
                volume={data.kospi_volume}
              />
            </div>
            <div className="relative">
              <IndexCard
                label="KOSDAQ"
                value={data.kosdaq_index}
                change={data.kosdaq_change}
                volume={data.kosdaq_volume}
              />
            </div>
          </div>

          {/* ── 글로벌 시장 ── */}
          <GlobalMarketSection data={data} />

          {/* ── 2행: 외국인 / 기관 수급 카드 ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FlowCard label="외국인" value={data.foreign_net} />
            <FlowCard label="기관" value={data.institution_net} />
          </div>

          {/* ── 3행: 시장 점수 게이지 + 국면 + 지표 ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 시장 점수 게이지 (전체 너비) */}
            <MarketScoreCard
              score={data.market_score}
              phase={data.market_phase}
              stance={data.overall_stance}
              indicators={data.indicators}
              generatedAt={data.generated_at}
            />

            {/* 시장 국면 */}
            <MarketPhaseCard
              phase={data.market_phase}
              stance={data.overall_stance}
            />

            {/* 시장 지표 */}
            <MarketIndicatorsCard
              kospiVolume={data.kospi_volume}
              kosdaqVolume={data.kosdaq_volume}
              indicators={data.indicators}
            />
          </div>

          {/* ── 4행: 관심종목 현황 ── */}
          <WatchlistSection />
        </div>
      )}
    </div>
  );
}
