"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ArrowLeft, TrendingUp, TrendingDown, Star, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, getChangeColor, formatChange } from "@/lib/utils";
import { fetchStockPrice, type StockPrice } from "@/lib/api";

/** 주가 차트 컴포넌트 (Recharts LineChart) */
function StockPriceChart({
  data,
  ticker,
}: {
  data: StockPrice["price_history"];
  ticker: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        주가 데이터 없음
      </div>
    );
  }

  // 주가 범위 계산 (Y축 여백 추가)
  const prices = data.map((d) => d.close);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const padding = (maxPrice - minPrice) * 0.05;

  // 등락 방향으로 선 색상 결정
  const firstPrice = data[0]?.close ?? 0;
  const lastPrice = data[data.length - 1]?.close ?? 0;
  const lineColor = lastPrice >= firstPrice ? "#05C075" : "#F04452";

  // 날짜 표시: MM/DD
  const displayData = data.map((d) => ({
    ...d,
    label: d.date.slice(5).replace("-", "/"),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={displayData}
        margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minPrice - padding, maxPrice + padding]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => formatNumber(v)}
          width={70}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
            fontSize: "13px",
          }}
          formatter={(value: number) => [
            `${formatNumber(value)}원`,
            ticker,
          ]}
          labelStyle={{ color: "hsl(var(--muted-foreground))" }}
        />
        <Line
          type="monotone"
          dataKey="close"
          stroke={lineColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: lineColor }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/**
 * 종목 상세 페이지 (/stock/[ticker])
 * - pykrx 실제 OHLCV 데이터 표시
 * - 현재가, 등락률, 거래량 카드
 */
export default function StockDetailPage() {
  const params = useParams();
  const ticker = (params?.ticker as string) ?? "";

  const [stockData, setStockData] = useState<StockPrice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStockPrice = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchStockPrice(ticker, 30);
      setStockData(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "주가 데이터를 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    loadStockPrice();
  }, [loadStockPrice]);

  const colorClass = getChangeColor(stockData?.change_rate ?? 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 뒤로 가기 + 헤더 */}
      <div className="flex items-center gap-4">
        <Link href="/stock">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            종목 목록
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">
              {stockData?.name ?? ticker}
            </h1>
            <Badge variant="secondary" className="font-mono">
              {ticker}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadStockPrice}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
          <Link href="/watchlist">
            <Button variant="outline" size="sm" className="gap-2">
              <Star className="w-4 h-4" />
              관심 추가
            </Button>
          </Link>
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="space-y-2">
                  <div className="h-3 bg-secondary rounded animate-pulse w-16" />
                  <div className="h-8 bg-secondary rounded animate-pulse w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 현재가 + 등락률 카드 */}
      {!loading && stockData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                현재가
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground tabular-nums">
                {formatNumber(stockData.current_price)}원
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                등락률
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold flex items-center gap-1 tabular-nums ${colorClass}`}>
                {stockData.change_rate >= 0 ? (
                  <TrendingUp className="w-5 h-5" />
                ) : (
                  <TrendingDown className="w-5 h-5" />
                )}
                {formatChange(stockData.change_rate)}
              </div>
              <p className={`text-sm mt-1 tabular-nums ${colorClass}`}>
                {stockData.change >= 0 ? "+" : ""}
                {formatNumber(stockData.change)}원
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                거래량
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground tabular-nums">
                {formatNumber(stockData.current_volume)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">주</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 주가 차트 */}
      {!loading && stockData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              주가 차트 (최근 30거래일)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StockPriceChart
              data={stockData.price_history}
              ticker={stockData.name}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
