"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Star, Plus, Trash2, RefreshCw, Wifi, WifiOff } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase, type WatchlistItem } from "@/lib/supabase";

const INPUT_CLS =
  "flex-1 min-w-0 px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

/** 관심 종목 추가 폼 컴포넌트 */
function AddWatchlistForm({
  onAdd,
}: {
  onAdd: (ticker: string, name: string, market: string, note: string) => Promise<void>;
}) {
  const [ticker, setTicker] = useState("");
  const [name, setName] = useState("");
  const [market, setMarket] = useState("KOSPI");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticker.trim() || !name.trim()) return;

    setLoading(true);
    try {
      await onAdd(ticker.trim().toUpperCase(), name.trim(), market, note.trim());
      setTicker("");
      setName("");
      setMarket("KOSPI");
      setNote("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
      <input
        type="text"
        placeholder="종목 코드 (예: 005930)"
        value={ticker}
        onChange={(e) => setTicker(e.target.value)}
        maxLength={10}
        className={INPUT_CLS}
      />
      <input
        type="text"
        placeholder="종목명 (예: 삼성전자)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={INPUT_CLS}
      />
      {/* 마켓 선택 */}
      <select
        value={market}
        onChange={(e) => setMarket(e.target.value)}
        className="px-3 py-2 rounded-md bg-secondary border border-border text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="KOSPI">KOSPI</option>
        <option value="KOSDAQ">KOSDAQ</option>
      </select>
      <input
        type="text"
        placeholder="메모 (선택)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={INPUT_CLS}
      />
      <Button
        type="submit"
        size="sm"
        disabled={loading || !ticker.trim() || !name.trim()}
        className="gap-2 flex-shrink-0"
      >
        <Plus className="w-4 h-4" />
        추가
      </Button>
    </form>
  );
}

/**
 * 관심 종목 페이지 (watchlist)
 * - Supabase watchlist 테이블 CRUD
 * - Supabase Realtime으로 실시간 변경 감지
 * - 종목 추가 / 삭제 기능
 */
export default function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Realtime 구독 채널 ref
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  /** 관심 종목 목록 로드 */
  const loadWatchlist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: sbError } = await supabase
        .from("watchlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (sbError) {
        // 테이블 미생성 시 사용자 친화적 안내
        if (sbError.message.includes("schema cache") || sbError.message.includes("watchlist")) {
          throw new Error(
            "watchlist 테이블이 없습니다. Supabase 대시보드 > SQL Editor에서 backend/migrations/001_create_tables.sql 을 실행해 주세요."
          );
        }
        throw new Error(sbError.message);
      }
      setItems((data as WatchlistItem[]) ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "관심 종목을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /** 종목 추가 — insert 성공 시 즉시 목록 갱신 */
  async function handleAdd(ticker: string, name: string, market: string, note: string) {
    const { error: sbError } = await supabase.from("watchlist").insert({
      ticker,
      name,
      market,
      note: note || null,
      added_at: new Date().toISOString(),
    });

    if (sbError) {
      setError(sbError.message);
    } else {
      await loadWatchlist();
    }
  }

  /** 종목 삭제 — delete 성공 시 즉시 목록 갱신 */
  async function handleDelete(id: string) {
    const { error: sbError } = await supabase
      .from("watchlist")
      .delete()
      .eq("id", id);

    if (sbError) {
      setError(sbError.message);
    } else {
      await loadWatchlist();
    }
  }

  // Supabase Realtime 구독 설정
  useEffect(() => {
    loadWatchlist();

    // watchlist 테이블 변경 이벤트 구독
    const channel = supabase
      .channel("watchlist-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watchlist" },
        (payload) => {
          // INSERT 이벤트
          if (payload.eventType === "INSERT") {
            setItems((prev) => [payload.new as WatchlistItem, ...prev]);
          }
          // DELETE 이벤트
          else if (payload.eventType === "DELETE") {
            setItems((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          }
          // UPDATE 이벤트
          else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((item) =>
                item.id === payload.new.id
                  ? (payload.new as WatchlistItem)
                  : item
              )
            );
          }
        }
      )
      .subscribe((status) => {
        // 구독 상태 모니터링
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // 언마운트 시 구독 해제
    return () => {
      channel.unsubscribe();
    };
  }, [loadWatchlist]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-400" />
            관심 종목
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            나의 관심 종목 목록 — Supabase Realtime 실시간 동기화
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Realtime 연결 상태 표시 */}
          <div className="flex items-center gap-1.5">
            {realtimeConnected ? (
              <>
                <Wifi className="w-4 h-4 text-green-400" />
                <span className="text-xs text-green-400">실시간 연결됨</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">연결 중...</span>
              </>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadWatchlist}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      {/* 종목 추가 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
            <Plus className="w-4 h-4" />
            관심 종목 추가
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AddWatchlistForm onAdd={handleAdd} />
        </CardContent>
      </Card>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* 관심 종목 테이블 */}
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-sm text-muted-foreground">
            관심 종목 목록{" "}
            <Badge variant="secondary" className="ml-1.5">
              {items.length}개
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 로딩 */}
          {loading && (
            <div className="py-12 text-center">
              <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">로딩 중...</p>
            </div>
          )}

          {/* 빈 목록 */}
          {!loading && items.length === 0 && (
            <div className="py-16 text-center">
              <Star className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                관심 종목이 없습니다.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                위 폼에서 종목을 추가하세요.
              </p>
            </div>
          )}

          {/* 데이터 테이블 */}
          {!loading && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>종목명</TableHead>
                  <TableHead>코드</TableHead>
                  <TableHead>마켓</TableHead>
                  <TableHead>메모</TableHead>
                  <TableHead>추가일</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        <span className="font-medium text-foreground">
                          {item.alias ?? item.name}
                        </span>
                        {item.alias && (
                          <span className="text-xs text-muted-foreground">
                            ({item.name})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {item.ticker}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {item.market ?? "KOSPI"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground/70">
                        {item.note ?? "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.added_at ?? item.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(item.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Supabase Realtime 안내 */}
      <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Supabase Realtime이 연결되면 다른 기기에서 추가/삭제한 종목이
          자동으로 반영됩니다. Supabase 대시보드에서 watchlist 테이블의
          Realtime을 활성화해야 합니다.
        </p>
      </div>
    </div>
  );
}
