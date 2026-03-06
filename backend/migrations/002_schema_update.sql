-- KSI 스키마 업데이트 마이그레이션 (002)
-- 실행일: 2026-03-07
-- 주의: 기존 strategies 테이블(일별 시장전략)은 스키마가 달라 수정하지 않음

-- ── 1. watchlist 누락 컬럼 추가 ──────────────────────
ALTER TABLE public.watchlist
    ADD COLUMN IF NOT EXISTS market   VARCHAR(10)  NOT NULL DEFAULT 'KOSPI';
ALTER TABLE public.watchlist
    ADD COLUMN IF NOT EXISTS alias    VARCHAR(50);
ALTER TABLE public.watchlist
    ADD COLUMN IF NOT EXISTS user_id  UUID REFERENCES auth.users ON DELETE CASCADE;
ALTER TABLE public.watchlist
    ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ  DEFAULT now();

UPDATE public.watchlist SET added_at = created_at WHERE added_at IS NULL;

DROP INDEX IF EXISTS public.watchlist_ticker_unique;
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_ticker_unique
    ON public.watchlist (COALESCE(user_id::TEXT, ''), ticker);

-- ── 2. market_reports 신규 생성 ──────────────────────
CREATE TABLE IF NOT EXISTS public.market_reports (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date  DATE        NOT NULL,
    report_type  VARCHAR(20) NOT NULL,
    market_score INTEGER,
    content      JSONB       NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT market_reports_date_type_unique UNIQUE (report_date, report_type)
);
CREATE INDEX IF NOT EXISTS market_reports_date_idx
    ON public.market_reports (report_date DESC, report_type);
ALTER TABLE public.market_reports REPLICA IDENTITY FULL;
ALTER TABLE public.market_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "market_reports_all_access" ON public.market_reports
    FOR ALL USING (true) WITH CHECK (true);

-- ── 3. stock_snapshots 신규 생성 ─────────────────────
CREATE TABLE IF NOT EXISTS public.stock_snapshots (
    ticker      VARCHAR(10) NOT NULL,
    trade_date  DATE        NOT NULL,
    open        NUMERIC, high NUMERIC, low NUMERIC, close NUMERIC,
    volume      BIGINT,
    change_pct  NUMERIC,
    per         NUMERIC,
    pbr         NUMERIC,
    fetched_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (ticker, trade_date)
);
CREATE INDEX IF NOT EXISTS stock_snapshots_date_idx
    ON public.stock_snapshots (trade_date DESC);
ALTER TABLE public.stock_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stock_snapshots_all_access" ON public.stock_snapshots
    FOR ALL USING (true) WITH CHECK (true);

-- ── 4. Realtime 등록 ──────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_snapshots;
