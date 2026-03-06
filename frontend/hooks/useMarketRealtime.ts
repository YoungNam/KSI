"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchMarketSummary, type MarketSummary } from "@/lib/api";

/**
 * Supabase Realtime을 활용한 시장 데이터 자동 갱신 훅
 *
 * 동작 방식:
 * 1. 초기 마운트 시 REST API로 최신 시장 데이터 로드
 * 2. Supabase Realtime으로 market_summary 테이블 변경 감지
 * 3. INSERT/UPDATE 이벤트 발생 시 최신 데이터 자동 갱신
 * 4. 폴백: 5분마다 REST API 폴링 (Realtime 미연결 시)
 */
export function useMarketRealtime() {
  const [data, setData] = useState<MarketSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // 폴링 인터벌 ref (cleanup용)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Realtime 채널 ref
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /** REST API에서 시장 데이터 로드 */
  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const summary = await fetchMarketSummary();
      setData(summary);
      setLastUpdated(new Date());
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "시장 데이터를 불러오지 못했습니다."
      );
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 초기 데이터 로드
    loadData();

    // Supabase Realtime 구독 — market_summary 테이블
    const channel = supabase
      .channel("market-summary-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "market_summary",
        },
        () => {
          // 새 데이터 삽입 시 REST API에서 최신 데이터 재로드 (백그라운드)
          loadData(false);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "market_summary",
        },
        () => {
          loadData(false);
        }
      )
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setRealtimeConnected(connected);

        // Realtime 미연결 시 5분 폴링 폴백 설정
        if (!connected && !pollIntervalRef.current) {
          pollIntervalRef.current = setInterval(
            () => loadData(false),
            5 * 60 * 1000
          );
        }
        // Realtime 연결 성공 시 폴링 중단
        if (connected && pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      });

    channelRef.current = channel;

    return () => {
      // 언마운트 시 구독 해제 + 폴링 중단
      channel.unsubscribe();
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [loadData]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    realtimeConnected,
    /** 수동 새로고침 */
    refresh: () => loadData(true),
  };
}
