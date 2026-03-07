/**
 * KSI 백엔드 API 호출 함수 모음
 * 기반: fetch API + NEXT_PUBLIC_API_URL 환경변수
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ─── 타입 정의 ───────────────────────────────────────────────

/** 시장 요약 데이터 (GET /api/v1/market/summary) */
export interface MarketSummary {
  kospi_index: number;
  kospi_change: number;
  kosdaq_index: number;
  kosdaq_change: number;
  kospi_volume: string;    // 백엔드에서 포맷된 문자열 예: "8.5조"
  kosdaq_volume: string;   // 예: "5.2조"
  foreign_net: string;     // 예: "+2,345억" 또는 "—"
  institution_net: string; // 예: "-1,234억" 또는 "—"
  market_score: number;
  market_phase: string;
  overall_stance: string;
  indicators: Record<string, unknown>;
  // 글로벌 시장 데이터
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
  generated_at: string;
}

/** 특징주 종목 데이터 */
export interface FeaturedStock {
  name: string;
  ticker: string;
  action: string;
  reason: string;
  target: number | null;
  stop: number | null;
}

/** 특징주 목록 (GET /api/v1/stocks/featured) */
export interface FeaturedStocks {
  market: string;
  stocks: FeaturedStock[];
  count: number;
  generated_at: string;
}

/** 전략 내 핵심 종목 */
export interface KeyStock {
  ticker: string;
  name: string;
  action: string;
  target_price?: number;
  stop_loss?: number;
  risk_level?: string;
  reason?: string;
}

/** 오늘의 전략 데이터 (GET /api/v1/strategy/today) */
export interface StrategyData {
  market_phase: string;
  market_score: number;
  overall_stance: string;
  /** 포지션 비중: aggressive / neutral / defensive (합계 100) */
  position_weights: {
    aggressive?: number;
    neutral?: number;
    defensive?: number;
    [key: string]: number | undefined;
  };
  short_term: {
    period?: string;
    approach?: string;
    key_stocks?: KeyStock[];
    [key: string]: unknown;
  };
  mid_term: {
    period?: string;
    approach?: string;
    key_stocks?: KeyStock[];
    [key: string]: unknown;
  };
  risk_management: {
    max_loss_per_trade?: string;
    portfolio_stop_loss?: string;
    notes?: string;
    [key: string]: unknown;
  };
  summary: string;
}

export interface TodayStrategy {
  strategy_date: string;
  file: string;
  data: StrategyData;
  is_stale?: boolean; // 당일 전략이 아닌 경우 true
}

/** 개별 종목 주가 포인트 */
export interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 종목 주가 히스토리 (GET /api/v1/stocks/{ticker}/price) */
export interface StockPrice {
  ticker: string;
  name: string;
  current_price: number;
  change: number;
  change_rate: number;
  current_volume: number;
  price_history: PricePoint[];
  generated_at: string;
}


// ─── 공통 fetch 래퍼 ───────────────────────────────────────

/**
 * 기본 fetch 래퍼 — JSON 응답 파싱 + 에러 처리
 */
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API 오류 [${res.status}]: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

// ─── API 함수 ─────────────────────────────────────────────

/**
 * 시장 요약 조회
 * GET /api/v1/market/summary
 */
export async function fetchMarketSummary(): Promise<MarketSummary> {
  return apiFetch<MarketSummary>("/api/v1/market/summary");
}

/**
 * 특징주 목록 조회
 * GET /api/v1/stocks/featured?market=ALL&top_n=10
 */
export async function fetchFeaturedStocks(
  market: "KOSPI" | "KOSDAQ" | "ALL" = "ALL",
  topN: number = 10
): Promise<FeaturedStocks> {
  return apiFetch<FeaturedStocks>(
    `/api/v1/stocks/featured?market=${market}&top_n=${topN}`
  );
}

/**
 * 오늘의 전략 조회
 * GET /api/v1/strategy/today
 */
export async function fetchTodayStrategy(): Promise<TodayStrategy> {
  return apiFetch<TodayStrategy>("/api/v1/strategy/today");
}


/**
 * 종목 주가 히스토리 조회
 * GET /api/v1/stocks/{ticker}/price?days=30
 */
export async function fetchStockPrice(
  ticker: string,
  days: number = 30
): Promise<StockPrice> {
  return apiFetch<StockPrice>(
    `/api/v1/stocks/${ticker}/price?days=${days}`
  );
}

/**
 * 전략 독립 생성 요청
 * POST /api/v1/strategy/generate
 */
export async function generateStrategy(): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/api/v1/strategy/generate", {
    method: "POST",
  });
}

/**
 * 전략 생성 상태 조회
 * GET /api/v1/strategy/status → "idle" | "running" | "done" | "failed: ..."
 */
export async function fetchStrategyStatus(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>("/api/v1/strategy/status");
}

