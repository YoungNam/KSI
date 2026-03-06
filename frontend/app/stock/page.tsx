"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { fetchFeaturedStocks, type FeaturedStocks } from "@/lib/api";
import { formatNumber, formatDateKo } from "@/lib/utils";

/** 시장 필터 타입 */
type MarketFilter = "ALL" | "KOSPI" | "KOSDAQ";

/** 방향(action)에 따른 배지 변형 반환 */
function getActionVariant(
  action: string
): "buy" | "sell" | "watch" {
  const a = action?.toLowerCase() ?? "";
  if (a.includes("매수") || a.includes("buy")) return "buy";
  if (a.includes("매도") || a.includes("sell")) return "sell";
  return "watch";
}

/** 특징주 테이블 행 */
function StockTableRow({
  stock,
  index,
}: {
  stock: FeaturedStocks["stocks"][0];
  index: number;
}) {
  return (
    <TableRow>
      {/* 순번 */}
      <TableCell className="text-muted-foreground text-xs w-10">
        {index + 1}
      </TableCell>

      {/* 종목명 */}
      <TableCell>
        <div className="font-medium text-foreground">{stock.name}</div>
      </TableCell>

      {/* 티커 */}
      <TableCell>
        <span className="text-xs font-mono text-muted-foreground">
          {stock.ticker}
        </span>
      </TableCell>

      {/* 방향 배지 */}
      <TableCell>
        <Badge variant={getActionVariant(stock.action)}>
          {stock.action}
        </Badge>
      </TableCell>

      {/* 목표가 */}
      <TableCell className="text-right">
        {stock.target != null ? (
          <span className="text-green-400 font-medium">
            {formatNumber(stock.target)}원
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>

      {/* 손절가 */}
      <TableCell className="text-right">
        {stock.stop != null ? (
          <span className="text-red-400 font-medium">
            {formatNumber(stock.stop)}원
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )}
      </TableCell>

      {/* 선정 이유 */}
      <TableCell className="max-w-xs">
        <p className="text-sm text-foreground/70 line-clamp-2 leading-relaxed">
          {stock.reason}
        </p>
      </TableCell>
    </TableRow>
  );
}

/** 특징주 테이블 */
function StocksTable({ stocks }: { stocks: FeaturedStocks["stocks"] }) {
  if (stocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="w-10 h-10 mb-3" />
        <p className="text-sm">표시할 종목이 없습니다.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>종목명</TableHead>
          <TableHead>코드</TableHead>
          <TableHead>방향</TableHead>
          <TableHead className="text-right">목표가</TableHead>
          <TableHead className="text-right">손절가</TableHead>
          <TableHead>선정 이유</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {stocks.map((stock, i) => (
          <StockTableRow
            key={`${stock.ticker}-${i}`}
            stock={stock}
            index={i}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/** 요약 통계 카드 */
function SummaryCards({
  stocks,
}: {
  stocks: FeaturedStocks["stocks"];
}) {
  const buyCount = stocks.filter((s) =>
    s.action?.toLowerCase().includes("매수")
  ).length;
  const sellCount = stocks.filter((s) =>
    s.action?.toLowerCase().includes("매도")
  ).length;
  const watchCount = stocks.length - buyCount - sellCount;

  return (
    <div className="grid grid-cols-3 gap-3">
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-green-400">{buyCount}</div>
          <p className="text-xs text-muted-foreground mt-1">매수</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{watchCount}</div>
          <p className="text-xs text-muted-foreground mt-1">관망</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-4 text-center">
          <div className="text-2xl font-bold text-red-400">{sellCount}</div>
          <p className="text-xs text-muted-foreground mt-1">매도</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * 종목 스캔 페이지
 * - KOSPI / KOSDAQ / ALL 탭 필터
 * - 특징주 테이블 (종목명, 코드, 방향 배지, 목표가, 손절가, 이유)
 * - "스캔 실행" 버튼 → API 재호출
 */
export default function StockPage() {
  const [activeMarket, setActiveMarket] = useState<MarketFilter>("ALL");
  const [data, setData] = useState<Record<MarketFilter, FeaturedStocks | null>>(
    { ALL: null, KOSPI: null, KOSDAQ: null }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 현재 선택된 시장의 특징주 스캔 */
  const loadStocks = useCallback(
    async (market: MarketFilter) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFeaturedStocks(market, 20);
        setData((prev) => ({ ...prev, [market]: result }));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "종목 데이터를 불러오지 못했습니다."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // 탭 변경 시 해당 시장 데이터 없으면 로드
  useEffect(() => {
    if (!data[activeMarket]) {
      loadStocks(activeMarket);
    }
  }, [activeMarket, data, loadStocks]);

  // 마운트 시 ALL 데이터 초기 로드
  useEffect(() => {
    loadStocks("ALL");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentData = data[activeMarket];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">종목 스캔</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI 선정 특징주 · KOSPI · KOSDAQ
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => loadStocks(activeMarket)}
          disabled={loading}
          className="gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              스캔 중...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              스캔 실행
            </>
          )}
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 요약 카드 */}
      {currentData && (
        <SummaryCards stocks={currentData.stocks} />
      )}

      {/* 시장 탭 필터 */}
      <Tabs
        value={activeMarket}
        onValueChange={(v) => setActiveMarket(v as MarketFilter)}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <TabsList>
            <TabsTrigger value="ALL">
              전체
              {data.ALL && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({data.ALL.count})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="KOSPI">
              KOSPI
              {data.KOSPI && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({data.KOSPI.count})
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="KOSDAQ">
              KOSDAQ
              {data.KOSDAQ && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  ({data.KOSDAQ.count})
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 생성 시각 */}
          {currentData?.generated_at && (
            <span className="text-xs text-muted-foreground">
              분석 시각: {formatDateKo(currentData.generated_at)}
            </span>
          )}
        </div>

        {/* ALL 탭 */}
        <TabsContent value="ALL">
          <StockTabContent
            data={data.ALL}
            loading={loading && activeMarket === "ALL"}
          />
        </TabsContent>

        {/* KOSPI 탭 */}
        <TabsContent value="KOSPI">
          <StockTabContent
            data={data.KOSPI}
            loading={loading && activeMarket === "KOSPI"}
          />
        </TabsContent>

        {/* KOSDAQ 탭 */}
        <TabsContent value="KOSDAQ">
          <StockTabContent
            data={data.KOSDAQ}
            loading={loading && activeMarket === "KOSDAQ"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 탭별 콘텐츠 (로딩 / 데이터) */
function StockTabContent({
  data,
  loading,
}: {
  data: FeaturedStocks | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-muted-foreground">
            특징주 스캔 중...
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            &quot;스캔 실행&quot; 버튼을 눌러 종목을 스캔하세요.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm text-muted-foreground">
          {data.market} 특징주 {data.count}종목
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <StocksTable stocks={data.stocks} />
      </CardContent>
    </Card>
  );
}
