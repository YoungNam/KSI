"""
market_data.py — FinanceDataReader 기반 시장 데이터 수집 (pykrx fallback)

함수:
  fetch_korean_market()  → KoreanMarket
  fetch_global_market()  → GlobalMarket
  get_stock_name(ticker) → str  (종목명 캐시)
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from agents.report_writer import GlobalMarket, KoreanMarket


# ────────────────────────────────────────────────
# 종목명 캐시 (FDR StockListing 기반)
# ────────────────────────────────────────────────

_stock_name_cache: dict[str, str] = {}
_cache_loaded = False


def _load_stock_names():
    """종목명 캐시 로드 — FDR StockListing 시도, 실패 시 KRX API 직접 호출"""
    global _stock_name_cache, _cache_loaded
    if _cache_loaded:
        return

    # 1차: FDR StockListing
    try:
        import FinanceDataReader as fdr
        for mkt in ["KOSPI", "KOSDAQ"]:
            listing = fdr.StockListing(mkt)
            for _, row in listing.iterrows():
                code = str(row.get("Code", row.get("Symbol", "")))
                name = str(row.get("Name", ""))
                if code and name:
                    _stock_name_cache[code] = name
        if _stock_name_cache:
            _cache_loaded = True
            print(f"[market_data] 종목명 캐시 완료 (FDR): {len(_stock_name_cache)}종목")
            return
    except Exception as e:
        print(f"[market_data] FDR 종목명 로드 실패: {e}")

    # 2차: KRX Open API 직접 호출
    try:
        import requests
        for mkt_id in ["STK", "KSQ"]:  # STK=KOSPI, KSQ=KOSDAQ
            url = "http://data.krx.co.kr/comm/bldAttendant/getJsonData.cmd"
            payload = {
                "bld": "dbms/MDC/STAT/standard/MDCSTAT01901",
                "mktId": mkt_id,
                "share": "1",
                "csvxls_is498No": "",
            }
            headers = {"User-Agent": "Mozilla/5.0", "Referer": "http://data.krx.co.kr/"}
            r = requests.post(url, data=payload, headers=headers, timeout=10)
            if r.status_code == 200:
                data = r.json()
                for item in data.get("OutBlock_1", []):
                    code = item.get("ISU_SRT_CD", "")
                    name = item.get("ISU_ABBRV", "")
                    if code and name:
                        _stock_name_cache[code] = name
        if _stock_name_cache:
            _cache_loaded = True
            print(f"[market_data] 종목명 캐시 완료 (KRX API): {len(_stock_name_cache)}종목")
            return
    except Exception as e:
        print(f"[market_data] KRX API 종목명 로드 실패: {e}")


def get_stock_name(ticker: str) -> str:
    """종목 코드 → 종목명 반환 (캐시 활용, 미스 시 pykrx 단건 조회)"""
    _load_stock_names()
    if ticker in _stock_name_cache:
        return _stock_name_cache[ticker]

    # 캐시 미스 — pykrx 단건 조회 (Railway에서 작동 확인됨)
    try:
        from pykrx import stock
        name = stock.get_market_ticker_name(ticker)
        if name:
            _stock_name_cache[ticker] = name
            return name
    except Exception:
        pass
    return ticker


def _fmt_net(value: float) -> str:
    """순매수 금액을 '±X억' 형식으로 포맷"""
    billions = value / 1e8
    sign = "+" if billions >= 0 else ""
    return f"{sign}{billions:,.0f}억"


def _fmt_volume(value: float) -> str:
    """거래대금을 'X.X조 / X,XXX억' 형식으로 포맷"""
    if value >= 1e12:
        return f"{value / 1e12:.1f}조"
    return f"{value / 1e8:,.0f}억"


def _recent_trading_date(days_back: int = 5) -> tuple[str, str]:
    """최근 N일 전 ~ 오늘 날짜 문자열 반환 (YYYYMMDD)"""
    today = datetime.today()
    start = today - timedelta(days=days_back)
    return start.strftime("%Y%m%d"), today.strftime("%Y%m%d")


# ────────────────────────────────────────────────
# 국내 시장 데이터
# ────────────────────────────────────────────────

def fetch_korean_market() -> KoreanMarket:
    """KOSPI·KOSDAQ 지수 및 외국인·기관 수급 수집 (FDR 우선, pykrx fallback)"""
    try:
        import FinanceDataReader as fdr

        start = (datetime.today() - timedelta(days=10)).strftime("%Y-%m-%d")
        end   = datetime.today().strftime("%Y-%m-%d")

        # KOSPI (^KS11), KOSDAQ (^KQ11) — Yahoo Finance 심볼
        kospi_df  = fdr.DataReader("^KS11", start, end)
        kosdaq_df = fdr.DataReader("^KQ11", start, end)

        if kospi_df.empty or kosdaq_df.empty:
            return KoreanMarket()

        kospi_latest  = kospi_df.iloc[-1]
        kosdaq_latest = kosdaq_df.iloc[-1]

        # 등락률 계산 (전일 대비)
        kospi_prev  = float(kospi_df["Close"].iloc[-2]) if len(kospi_df) >= 2 else float(kospi_latest["Close"])
        kosdaq_prev = float(kosdaq_df["Close"].iloc[-2]) if len(kosdaq_df) >= 2 else float(kosdaq_latest["Close"])

        kospi_chg  = (float(kospi_latest["Close"])  - kospi_prev)  / kospi_prev  * 100
        kosdaq_chg = (float(kosdaq_latest["Close"]) - kosdaq_prev) / kosdaq_prev * 100

        # 거래대금·수급 — pykrx KRX API 호환 문제로 현재 미제공
        # TODO: KRX Open API 또는 pykrx 호환 버전 나오면 복구
        kospi_vol = "—"
        kosdaq_vol = "—"
        foreign_net = "—"
        inst_net = "—"

        return KoreanMarket(
            kospi_index=float(kospi_latest["Close"]),
            kospi_change=round(kospi_chg, 2),
            kosdaq_index=float(kosdaq_latest["Close"]),
            kosdaq_change=round(kosdaq_chg, 2),
            kospi_volume=kospi_vol,
            kosdaq_volume=kosdaq_vol,
            foreign_net=foreign_net,
            institution_net=inst_net,
        )

    except Exception as e:
        print(f"[market_data] 국내 시장 수집 실패: {e}")
        return KoreanMarket()


# ────────────────────────────────────────────────
# 글로벌 시장 데이터
# ────────────────────────────────────────────────

def fetch_global_market() -> GlobalMarket:
    """미국 증시·환율·원자재 수집 (FinanceDataReader 기반)"""
    try:
        import FinanceDataReader as fdr

        end   = datetime.today().strftime("%Y-%m-%d")
        start = (datetime.today() - timedelta(days=10)).strftime("%Y-%m-%d")

        def _latest_change(symbol: str) -> tuple[float, float]:
            """종가와 전일대비 등락률 반환. 실패 시 (0.0, 0.0)"""
            try:
                df = fdr.DataReader(symbol, start, end)
                if df.empty or len(df) < 2:
                    return 0.0, 0.0
                close  = float(df["Close"].iloc[-1])
                prev   = float(df["Close"].iloc[-2])
                change = (close - prev) / prev * 100
                return close, round(change, 2)
            except Exception:
                return 0.0, 0.0

        sp500_p,  sp500_c  = _latest_change("SP500")
        nasdaq_p, nasdaq_c = _latest_change("IXIC")
        wti_p,    wti_c    = _latest_change("WTI")
        gold_p,   gold_c   = _latest_change("GC=F")   # 금 선물

        # 달러/원 환율
        try:
            usd_df = fdr.DataReader("USD/KRW", start, end)
            if not usd_df.empty and len(usd_df) >= 2:
                usd_p = float(usd_df["Close"].iloc[-1])
                usd_c = float(usd_df["Close"].iloc[-1]) - float(usd_df["Close"].iloc[-2])
            else:
                usd_p = usd_c = 0.0
        except Exception:
            usd_p = usd_c = 0.0

        # 미국 10Y 국채 수익률
        try:
            tnx_df = fdr.DataReader("TNX", start, end)
            us10y = float(tnx_df["Close"].iloc[-1]) if not tnx_df.empty else 0.0
        except Exception:
            us10y = 0.0

        return GlobalMarket(
            sp500_price=sp500_p,   sp500_change=sp500_c,
            nasdaq_price=nasdaq_p, nasdaq_change=nasdaq_c,
            usd_krw=usd_p,         usd_krw_change=round(usd_c, 1),
            wti_price=wti_p,       wti_change=wti_c,
            gold_price=gold_p,     gold_change=gold_c,
            us10y_yield=us10y,
        )

    except Exception as e:
        print(f"[market_data] 글로벌 시장 수집 실패: {e}")
        return GlobalMarket()
