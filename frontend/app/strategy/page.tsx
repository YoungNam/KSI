"use client";

import React, { useCallback, useEffect, useState } from "react";
import { WatchlistSection } from "@/components/watchlist-section";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { RefreshCw, ShieldAlert, TrendingUp, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchTodayStrategy,
  generateStrategy,
  fetchStrategyStatus,
  type TodayStrategy,
  type KeyStock,
} from "@/lib/api";
import { getPhaseColor } from "@/lib/utils";

/** position_weights 영문 키 → 한국어 레이블 매핑 */
const POSITION_LABELS: Record<string, string> = {
  aggressive: "공격형",
  neutral:    "중립형",
  defensive:  "방어형",
};

/** 포지션 비중 PieChart 색상 */
const POSITION_COLORS = ["#3182F6", "#F5A623", "#05C075", "#8b5cf6", "#F04452"];

/** 포지션 비중 원형 차트 */
function PositionPieChart({
  weights,
}: {
  weights: Record<string, number | undefined>;
}) {
  const data = Object.entries(weights)
    .filter(([, v]) => v != null && v > 0)
    .map(([key, value]) => ({
      name:  POSITION_LABELS[key] ?? key,
      value: value as number,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        포지션 데이터 없음
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={POSITION_COLORS[index % POSITION_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
            fontSize: "13px",
          }}
          formatter={(value: number) => [`${value}%`, ""]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: "hsl(var(--muted-foreground))", fontSize: "12px" }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** 핵심 종목 테이블 */
function KeyStocksTable({ stocks }: { stocks: KeyStock[] | undefined }) {
  if (!stocks || stocks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">선정 종목 없음</p>
    );
  }

  // 매매 방향별 색상
  const actionColor = (action: string) => {
    if (action.includes("매수")) return "text-[#05C075]";
    if (action.includes("매도")) return "text-[#F04452]";
    return "text-[#F5A623]";
  };

  // 리스크 레벨 뱃지 변형
  const riskVariant = (level: string | undefined) => {
    if (!level) return "secondary";
    if (level === "높음") return "destructive";
    if (level === "낮음") return "outline";
    return "secondary";
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>종목</TableHead>
          <TableHead>방향</TableHead>
          <TableHead className="text-right">목표가</TableHead>
          <TableHead className="text-right">손절가</TableHead>
          <TableHead>리스크</TableHead>
          <TableHead>근거</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stocks.map((s, i) => (
          <TableRow key={`${s.ticker}-${i}`}>
            <TableCell>
              <div>
                <p className="font-medium text-foreground">{s.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{s.ticker}</p>
              </div>
            </TableCell>
            <TableCell>
              <span className={`text-sm font-semibold ${actionColor(s.action)}`}>
                {s.action}
              </span>
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm text-foreground">
              {s.target_price ? `${s.target_price.toLocaleString()}원` : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums text-sm text-foreground">
              {s.stop_loss ? `${s.stop_loss.toLocaleString()}원` : "—"}
            </TableCell>
            <TableCell>
              <Badge variant={riskVariant(s.risk_level) as "secondary" | "destructive" | "outline"}>
                {s.risk_level ?? "—"}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-foreground/70 max-w-[200px]">
              {s.reason ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** 리스크 관리 섹션 */
function RiskManagementSection({
  riskManagement,
}: {
  riskManagement: Record<string, unknown>;
}) {
  const keyLabels: Record<string, string> = {
    max_loss_per_trade:   "종목당 최대 손실",
    portfolio_stop_loss:  "포트폴리오 손절",
    notes:                "리스크 지침",
  };

  const entries = Object.entries(riskManagement).filter(([, v]) => v != null);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">리스크 관리 정보 없음</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {entries.map(([key, val]) => (
        <div key={key} className="flex flex-col gap-1 p-3 rounded-lg bg-secondary/50">
          <span className="text-xs text-muted-foreground font-medium">
            {keyLabels[key] ?? key}
          </span>
          <span className="text-sm text-foreground">{String(val)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * 투자 전략 페이지
 * - 시장 점수·국면·포지션 비중 PieChart
 * - 단기/중기 전략 탭 (approach 텍스트 + key_stocks 테이블)
 * - 리스크 관리 섹션
 */
export default function StrategyPage() {
  const [strategy, setStrategy] = useState<TodayStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTodayStrategy();
      setStrategy(data);
    } catch (err) {
      // 404는 전략 없음 — 에러 대신 빈 상태로 처리
      if (err instanceof Error && err.message.includes("404")) {
        setStrategy(null);
      } else {
        setError(
          err instanceof Error ? err.message : "전략 데이터를 불러오지 못했습니다."
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStrategy();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [loadStrategy]);

  /** 전략 독립 생성 — 폴링으로 완료 감지 */
  async function handleGenerateStrategy() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setGenerating(true);
    setGenMessage(null);
    setError(null);
    try {
      await generateStrategy();
      setGenMessage("전략 생성 중...");

      const MAX_ATTEMPTS = 60; // 최대 5분 (5초 × 60)
      let attempt = 0;

      intervalRef.current = setInterval(async () => {
        attempt++;
        try {
          const { status } = await fetchStrategyStatus();
          if (status.startsWith("failed")) {
            setGenMessage(`전략 생성 실패: ${status.replace("failed: ", "")}`);
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setGenerating(false);
            return;
          }
          if (status === "done") {
            setGenMessage(null);
            clearInterval(intervalRef.current!);
            intervalRef.current = null;
            setGenerating(false);
            loadStrategy();
            return;
          }
          setGenMessage(`전략 생성 중... (${attempt * 5}초 경과)`);
        } catch {
          // 일시적 네트워크 오류 — 계속 대기
        }
        if (attempt >= MAX_ATTEMPTS) {
          clearInterval(intervalRef.current!);
          intervalRef.current = null;
          setGenerating(false);
          setGenMessage("전략 생성 시간 초과 — 새로고침 후 확인하세요.");
        }
      }, 5000);
    } catch (err) {
      setGenMessage(
        err instanceof Error ? err.message : "전략 생성 요청에 실패했습니다."
      );
      setGenerating(false);
    }
  }

  const phaseColors = strategy ? getPhaseColor(strategy.data.market_phase) : null;
  const isEmpty = !loading && !strategy;
  const isStale = strategy?.is_stale === true;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">투자 전략</h1>
          <p className="text-sm text-muted-foreground mt-1">AI 기반 오늘의 투자 전략</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleGenerateStrategy}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <TrendingUp className="w-4 h-4" />
                전략 생성
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStrategy}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 전략 생성 상태 메시지 */}
      {genMessage && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary flex items-center gap-2">
          {generating && (
            <span className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
          )}
          {genMessage}
        </div>
      )}

      {/* 이전 날짜 전략 안내 배너 */}
      {isStale && (
        <div className="rounded-lg border border-[#F5A623]/30 bg-[#F5A623]/10 px-4 py-3 text-sm text-[#F5A623] flex items-center gap-2">
          <Clock className="w-4 h-4 flex-shrink-0" />
          <span>
            {strategy.strategy_date} 기준 전략입니다. &quot;전략 생성&quot; 버튼으로 최신 전략을 생성하세요.
          </span>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 전략 없음 — CTA */}
      {isEmpty && !error && (
        <Card>
          <CardContent className="py-16 text-center">
            <TrendingUp className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-base font-medium text-foreground mb-1">
              생성된 투자 전략이 없습니다
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              &quot;전략 생성&quot; 버튼을 눌러 현재 시장 기반 AI 투자 전략을 생성하세요.
            </p>
            <Button
              onClick={handleGenerateStrategy}
              disabled={generating}
              className="gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              {generating ? "생성 중..." : "전략 생성하기"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-12">
                <div className="space-y-3">
                  <div className="h-4 bg-secondary rounded animate-pulse w-32" />
                  <div className="h-8 bg-secondary rounded animate-pulse w-24" />
                  <div className="h-4 bg-secondary rounded animate-pulse w-48" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 전략 데이터 */}
      {strategy && (
        <>
          {/* 상단: 시장 요약 + 포지션 비중 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 시장 점수 + 국면 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  오늘의 시장 요약
                </CardTitle>
                {strategy.strategy_date && (
                  <CardDescription className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {strategy.strategy_date}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">시장 점수</p>
                  <div className="flex items-end gap-2">
                    <span
                      className="text-5xl font-bold tabular-nums"
                      style={{ color: phaseColors?.bg ?? "#fff" }}
                    >
                      {strategy.data.market_score}
                    </span>
                    <span className="text-muted-foreground text-lg mb-1">/ 100</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">시장 국면</p>
                  <Badge className={phaseColors?.badge ?? ""} variant="outline">
                    {strategy.data.market_phase}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">투자 스탠스</p>
                  <p className="text-sm text-foreground">{strategy.data.overall_stance}</p>
                </div>
                {strategy.data.summary && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-2">전략 요약</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">
                      {strategy.data.summary}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 포지션 비중 PieChart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  포지션 비중 배분
                </CardTitle>
              </CardHeader>
              <CardContent>
                {strategy.data.position_weights ? (
                  <>
                    <PositionPieChart weights={strategy.data.position_weights} />
                    <div className="mt-2 flex flex-wrap gap-3 justify-center">
                      {Object.entries(strategy.data.position_weights)
                        .filter(([, v]) => v != null && v > 0)
                        .map(([key, value], i) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  POSITION_COLORS[i % POSITION_COLORS.length],
                              }}
                            />
                            <span className="text-xs text-muted-foreground">
                              {POSITION_LABELS[key] ?? key}: {value}%
                            </span>
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    포지션 데이터 없음
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 단기 / 중기 전략 탭 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                전략 상세
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="short">
                <TabsList>
                  <TabsTrigger value="short">
                    단기 전략 {strategy.data.short_term?.period && `(${strategy.data.short_term.period})`}
                  </TabsTrigger>
                  <TabsTrigger value="mid">
                    중기 전략 {strategy.data.mid_term?.period && `(${strategy.data.mid_term.period})`}
                  </TabsTrigger>
                </TabsList>

                {/* 단기 전략 */}
                <TabsContent value="short" className="space-y-4 mt-4">
                  {strategy.data.short_term.approach && (
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground mb-1">전략 방향</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {strategy.data.short_term.approach}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">핵심 종목</p>
                    <KeyStocksTable stocks={strategy.data.short_term.key_stocks} />
                  </div>
                </TabsContent>

                {/* 중기 전략 */}
                <TabsContent value="mid" className="space-y-4 mt-4">
                  {strategy.data.mid_term.approach && (
                    <div className="p-3 rounded-lg bg-secondary/50">
                      <p className="text-xs text-muted-foreground mb-1">전략 방향</p>
                      <p className="text-sm text-foreground leading-relaxed">
                        {strategy.data.mid_term.approach}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">핵심 종목</p>
                    <KeyStocksTable stocks={strategy.data.mid_term.key_stocks} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 리스크 관리 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-yellow-400" />
                리스크 관리
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RiskManagementSection
                riskManagement={strategy.data.risk_management}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* 관심종목 현황 */}
      <WatchlistSection />
    </div>
  );
}
