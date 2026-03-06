"use client";

import React, { useEffect, useState } from "react";
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
  Star,
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
import { supabase, WatchlistItem } from "@/lib/supabase";
import { fetchStockPrice, StockPrice } from "@/lib/api";

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
      <p className="text-xs font-medium text-[#8B96A9] uppercase tracking-wide mb-3">
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
        <p className="text-xs text-[#4E5C72] mt-3 tabular-nums">
          거래대금{" "}
          <span className="text-[#8B96A9]">{volume}</span>
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
            : "bg-[#8B96A9]",
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
    : "text-[#8B96A9]";
  const TrendIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <Card className="p-6 hover:border-[#3182F6]/40 transition-colors duration-200">
      {/* 레이블 */}
      <p className="text-xs font-medium text-[#8B96A9] uppercase tracking-wide mb-3">
        {label} 순매수
      </p>
      {/* 수급 금액 */}
      <div className={`flex items-center gap-2 ${colorClass}`}>
        <TrendIcon className="w-5 h-5 flex-shrink-0" />
        <span className="text-3xl font-bold tabular-nums">{value}</span>
      </div>
      <p className="text-xs text-[#4E5C72] mt-2">KOSPI + KOSDAQ 합산</p>
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
        <span className="text-xs text-[#8B96A9] mt-1.5 font-medium">
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
      <p className="text-xs font-medium text-[#8B96A9] uppercase tracking-wide mb-4">
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
          <p className="text-xs text-[#4E5C72] font-medium mb-3">기술 지표</p>
          <div className="grid grid-cols-2 gap-y-2.5 gap-x-4">
            {Object.entries(indicators)
              .slice(0, 6)
              .map(([key, val]) => (
                <div key={key} className="flex justify-between items-center">
                  <span className="text-xs text-[#8B96A9]">{key}</span>
                  <span className="text-xs font-semibold text-[#F0F4FF] tabular-nums">
                    {String(val)}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 분석 시각 */}
      {generatedAt && (
        <p className="text-[11px] text-[#4E5C72] mt-3">
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
      <p className="text-xs font-medium text-[#8B96A9] uppercase tracking-wide mb-4">
        시장 국면
      </p>

      {/* 국면명 — 큰 텍스트 강조 */}
      <p className={`text-2xl font-bold mb-1 ${colors.text}`}>{phase}</p>
      <Badge className={colors.badge} variant="outline">
        {phase}
      </Badge>

      {/* 투자 스탠스 */}
      <div className="mt-4 pt-4 border-t border-[#242D3D]">
        <p className="text-xs text-[#8B96A9] mb-1">투자 스탠스</p>
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
      <p className="text-xs font-medium text-[#8B96A9] uppercase tracking-wide mb-4">
        시장 지표
      </p>

      {/* 거래량 */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#8B96A9]">KOSPI 거래대금</span>
          <span className="text-sm font-semibold text-[#F0F4FF] tabular-nums">
            {kospiVolume}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#8B96A9]">KOSDAQ 거래대금</span>
          <span className="text-sm font-semibold text-[#F0F4FF] tabular-nums">
            {kosdaqVolume}
          </span>
        </div>
      </div>

      {/* 기술 지표 */}
      {indicators && Object.entries(indicators).length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#242D3D] space-y-2.5">
          <p className="text-xs text-[#4E5C72] font-medium">기술 지표</p>
          {Object.entries(indicators)
            .slice(0, 4)
            .map(([key, val]) => (
              <div key={key} className="flex justify-between items-center">
                <span className="text-xs text-[#8B96A9]">{key}</span>
                <span className="text-xs font-semibold text-[#F0F4FF] tabular-nums">
                  {String(val)}
                </span>
              </div>
            ))}
        </div>
      )}
    </Card>
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
   관심종목 아이템 스켈레톤 — 로딩 중 펄스 애니메이션
   ──────────────────────────────────────────────────────────── */
function WatchlistSkeletonItem() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#242D3D] last:border-b-0">
      {/* 왼쪽: 종목명 + 티커 */}
      <div className="space-y-1.5">
        <div className="h-3.5 bg-[#1E2535] rounded-full w-24 animate-pulse" />
        <div className="h-3 bg-[#1E2535] rounded-full w-16 animate-pulse" />
      </div>
      {/* 오른쪽: 현재가 + 등락률 */}
      <div className="text-right space-y-1.5">
        <div className="h-3.5 bg-[#1E2535] rounded-full w-20 animate-pulse ml-auto" />
        <div className="h-3 bg-[#1E2535] rounded-full w-14 animate-pulse ml-auto" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   관심종목 현황 섹션
   - Supabase watchlist 테이블에서 목록 조회
   - fetchStockPrice(ticker, 1)로 현재가 병렬 조회
   - 에러 발생 시 조용히 무시 (대시보드 전체에 영향 없도록)
   ──────────────────────────────────────────────────────────── */

/** 관심종목 + 현재가 결합 타입 */
interface WatchlistWithPrice extends WatchlistItem {
  priceData: StockPrice | null;
}

function WatchlistSection() {
  // 관심종목 + 가격 데이터 상태
  const [items, setItems] = useState<WatchlistWithPrice[]>([]);
  // 로딩 상태 (초기 true)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadWatchlist() {
      try {
        // 1단계: Supabase watchlist 테이블에서 관심종목 목록 조회
        const { data: watchlistRows, error } = await supabase
          .from("watchlist")
          .select("*")
          .order("added_at", { ascending: false });

        // 에러 발생 시 조용히 종료 (대시보드 전체에 영향 없음)
        if (error || !watchlistRows || watchlistRows.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        // 2단계: 각 종목의 현재가를 Promise.all로 병렬 조회 (days=1)
        const priceResults = await Promise.all(
          watchlistRows.map(async (item: WatchlistItem) => {
            try {
              const priceData = await fetchStockPrice(item.ticker, 1);
              return { ...item, priceData };
            } catch {
              // 개별 종목 가격 조회 실패 시 null 처리 (나머지 종목에 영향 없음)
              return { ...item, priceData: null };
            }
          })
        );

        setItems(priceResults);
      } catch {
        // 전체 조회 실패 시 빈 배열로 조용히 처리
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    loadWatchlist();
  }, []);

  return (
    <div className="rounded-2xl border border-[#242D3D] bg-[#161B27] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-5">
        <Star className="w-4 h-4 text-[#F5A623]" />
        <h2 className="text-sm font-semibold text-[#8B96A9] uppercase tracking-wide">
          관심종목 현황
        </h2>
      </div>

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <WatchlistSkeletonItem key={i} />
          ))}
        </div>
      )}

      {/* 관심종목 없음 안내 */}
      {!loading && items.length === 0 && (
        <div className="py-8 text-center">
          <Star className="w-8 h-8 text-[#242D3D] mx-auto mb-3" />
          <p className="text-sm text-[#4E5C72]">
            등록된 관심종목이 없습니다.
          </p>
          <p className="text-xs text-[#4E5C72] mt-1">
            <a
              href="/watchlist"
              className="text-[#3182F6] hover:underline underline-offset-2"
            >
              관심종목 페이지
            </a>
            를 방문하여 종목을 추가하세요.
          </p>
        </div>
      )}

      {/* 관심종목 목록 */}
      {!loading && items.length > 0 && (
        <div>
          {items.map((item) => {
            // 현재가 및 등락률 추출 (가격 데이터 없으면 대시 표시)
            const price = item.priceData?.current_price ?? null;
            const changeRate = item.priceData?.change_rate ?? null;
            const colorClass =
              changeRate !== null ? getChangeColor(changeRate) : "text-[#8B96A9]";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 border-b border-[#242D3D] last:border-b-0 hover:bg-[#1E2535]/50 -mx-2 px-2 rounded-lg transition-colors duration-150 cursor-pointer"
                onClick={() => window.location.href = `/stock/${item.ticker}`}
              >
                {/* 왼쪽: 종목명 + 시장 배지 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#F0F4FF] truncate">
                      {item.alias ?? item.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-[#242D3D] text-[#8B96A9] shrink-0"
                    >
                      {item.market}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#4E5C72] mt-0.5 tabular-nums">
                    {item.ticker}
                  </p>
                </div>

                {/* 오른쪽: 현재가 + 등락률 */}
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-bold text-[#F0F4FF] tabular-nums">
                    {price !== null ? `${formatNumber(price)}원` : "—"}
                  </p>
                  <p className={`text-xs font-semibold tabular-nums mt-0.5 ${colorClass}`}>
                    {changeRate !== null ? formatChange(changeRate) : "—"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
          <p className="text-sm text-[#8B96A9] mt-0.5">
            KOSPI · KOSDAQ 실시간 대시보드
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
                : "border-[#242D3D] bg-[#1E2535] text-[#8B96A9]",
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
            <span className="text-xs text-[#4E5C72] hidden md:flex items-center gap-1">
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
