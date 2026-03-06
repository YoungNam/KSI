-- KSI Supabase 테이블 초기화 마이그레이션
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 실행하세요.

-- ─────────────────────────────────────────────────
-- 1. watchlist 테이블
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.watchlist (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ticker      VARCHAR(10) NOT NULL,
    name        VARCHAR(50) NOT NULL,
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 중복 등록 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_ticker_unique
    ON public.watchlist (ticker);

-- Supabase Realtime 활성화 (변경 이벤트 수신)
ALTER TABLE public.watchlist REPLICA IDENTITY FULL;

-- RLS (Row Level Security) — 개발 중에는 전체 허용
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_all_access" ON public.watchlist
    FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────
-- 2. market_summary 테이블
-- ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.market_summary (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    kospi_index      NUMERIC(10, 2),
    kospi_change     NUMERIC(6, 2),
    kosdaq_index     NUMERIC(10, 2),
    kosdaq_change    NUMERIC(6, 2),
    kospi_volume     VARCHAR(20),   -- 예: "8.5조"
    kosdaq_volume    VARCHAR(20),   -- 예: "5.2조"
    foreign_net      VARCHAR(30),   -- 예: "+2,345억"
    institution_net  VARCHAR(30),   -- 예: "-1,234억"
    market_score     INTEGER,       -- 0 ~ 100
    market_phase     VARCHAR(20),   -- 강세 | 횡보 | 약세
    overall_stance   VARCHAR(20)    -- 공격적 | 중립 | 방어적
);

-- 최신 데이터 조회 인덱스
CREATE INDEX IF NOT EXISTS market_summary_recorded_at_idx
    ON public.market_summary (recorded_at DESC);

-- Realtime 활성화
ALTER TABLE public.market_summary REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE public.market_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_summary_all_access" ON public.market_summary
    FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────
-- Supabase Realtime Publication 등록
-- (이미 supabase_realtime publication이 있다면 아래만 실행)
-- ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.watchlist;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_summary;
