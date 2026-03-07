"use client";

/**
 * WatchlistSection — 관심종목 현황 공통 컴포넌트
 * 대시보드 / 브리핑 / 전략 페이지에서 공통으로 사용
 */

import React, { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase, type WatchlistItem } from "@/lib/supabase";
import { fetchStockPrice, type StockPrice } from "@/lib/api";
import { formatNumber, formatChange, getChangeColor } from "@/lib/utils";

/** 관심종목 + 현재가 결합 타입 */
interface WatchlistWithPrice extends WatchlistItem {
  priceData: StockPrice | null;
}

/* 로딩 중 스켈레톤 아이템 */
function SkeletonItem() {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#242D3D] last:border-b-0">
      <div className="space-y-1.5">
        <div className="h-3.5 bg-[#1E2535] rounded-full w-24 animate-pulse" />
        <div className="h-3 bg-[#1E2535] rounded-full w-16 animate-pulse" />
      </div>
      <div className="text-right space-y-1.5">
        <div className="h-3.5 bg-[#1E2535] rounded-full w-20 animate-pulse ml-auto" />
        <div className="h-3 bg-[#1E2535] rounded-full w-14 animate-pulse ml-auto" />
      </div>
    </div>
  );
}

export function WatchlistSection() {
  const [items, setItems] = useState<WatchlistWithPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        // Supabase watchlist 조회
        const { data: rows, error } = await supabase
          .from("watchlist")
          .select("*")
          .order("added_at", { ascending: false });

        if (error || !rows || rows.length === 0) {
          setItems([]);
          return;
        }

        // 각 종목 현재가 병렬 조회
        const results = await Promise.all(
          rows.map(async (item: WatchlistItem) => {
            try {
              const priceData = await fetchStockPrice(item.ticker, 5);
              return { ...item, priceData };
            } catch {
              return { ...item, priceData: null };
            }
          })
        );

        setItems(results);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="rounded-2xl border border-[#242D3D] bg-[#161B27] p-6 shadow-[0_2px_12px_rgba(0,0,0,0.3)]">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-5">
        <Star className="w-4 h-4 text-[#F5A623]" />
        <h2 className="text-sm font-semibold text-[#A0AEBF] uppercase tracking-wide">
          관심종목 현황
        </h2>
      </div>

      {/* 로딩 스켈레톤 */}
      {loading && (
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonItem key={i} />
          ))}
        </div>
      )}

      {/* 관심종목 없음 */}
      {!loading && items.length === 0 && (
        <div className="py-8 text-center">
          <Star className="w-8 h-8 text-[#242D3D] mx-auto mb-3" />
          <p className="text-sm text-[#6B7A8D]">등록된 관심종목이 없습니다.</p>
          <p className="text-xs text-[#6B7A8D] mt-1">
            <a
              href="/watchlist"
              className="text-[#3182F6] hover:underline underline-offset-2"
            >
              관심종목 페이지
            </a>
            에서 종목을 추가하세요.
          </p>
        </div>
      )}

      {/* 종목 목록 */}
      {!loading && items.length > 0 && (
        <div>
          {items.map((item) => {
            const price = item.priceData?.current_price ?? null;
            const changeRate = item.priceData?.change_rate ?? null;
            const colorClass =
              changeRate !== null ? getChangeColor(changeRate) : "text-[#A0AEBF]";

            return (
              <div
                key={item.id}
                className="flex items-center justify-between py-3 border-b border-[#242D3D] last:border-b-0 hover:bg-[#1E2535]/50 -mx-2 px-2 rounded-lg transition-colors duration-150 cursor-pointer"
                onClick={() => (window.location.href = `/stock/${item.ticker}`)}
              >
                {/* 종목명 + 마켓 배지 */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#F0F4FF] truncate">
                      {item.alias ?? item.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-[#242D3D] text-[#A0AEBF] shrink-0"
                    >
                      {item.market}
                    </Badge>
                  </div>
                  <p className="text-xs text-[#6B7A8D] mt-0.5 tabular-nums">
                    {item.ticker}
                  </p>
                </div>

                {/* 현재가 + 등락률 */}
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
