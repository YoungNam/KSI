import { createClient } from "@supabase/supabase-js";

/**
 * Supabase 클라이언트 싱글톤
 * - NEXT_PUBLIC_ 접두사로 브라우저에서도 사용 가능
 * - Realtime 기능 활성화
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[KSI] Supabase 환경변수가 설정되지 않았습니다. " +
    "frontend/.env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 설정하세요."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    // Supabase Realtime 연결 파라미터
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Supabase Database 타입 (향후 generate-types로 자동 생성 예정)
 * 현재는 수동으로 정의
 */
export interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;           // 종목명 (001 스키마 호환)
  market: string;         // 'KOSPI' | 'KOSDAQ'
  alias: string | null;   // 사용자 설정 별칭
  note: string | null;    // 메모
  user_id: string | null; // Supabase Auth 연동 시 사용
  added_at: string;       // 추가 시각 (created_at과 동일)
  created_at: string;
}

export interface MarketReportRecord {
  id: string;
  report_date: string;
  report_type: string;  // 'morning' | 'open' | 'close' | 'evening'
  market_score: number | null;
  content: Record<string, unknown>;
  created_at: string;
}

export interface StrategyRecord {
  id: string;
  ticker: string;
  strategy_type: string;  // 'SHORT' | 'MID' | 'LONG'
  target_price: number | null;
  stop_loss: number | null;
  content: Record<string, unknown>;
  valid_until: string | null;
  created_at: string;
}

export interface StockSnapshot {
  ticker: string;
  trade_date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  change_pct: number | null;
  per: number | null;
  pbr: number | null;
  fetched_at: string;
}

export interface MarketSummaryRecord {
  id: string;
  kospi_index: number;
  kospi_change: number;
  kosdaq_index: number;
  kosdaq_change: number;
  market_score: number;
  market_phase: string;
  overall_stance: string;
  generated_at: string;
}
