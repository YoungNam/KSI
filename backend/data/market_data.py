"""
market_data.py — pykrx + FinanceDataReader 기반 시장 데이터 수집

함수:
  fetch_korean_market()  → KoreanMarket
  fetch_global_market()  → GlobalMarket
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

from agents.report_writer import GlobalMarket, KoreanMarket


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
    """KOSPI·KOSDAQ 지수 및 외국인·기관 수급 수집"""
    try:
        from pykrx import stock

        start, end = _recent_trading_date(7)

        # KOSPI (코드: 1001)
        kospi_df = stock.get_index_ohlcv(start, end, "1001")
        # KOSDAQ (코드: 2001)
        kosdaq_df = stock.get_index_ohlcv(start, end, "2001")

        if kospi_df.empty or kosdaq_df.empty:
            return KoreanMarket()

        kospi_latest  = kospi_df.iloc[-1]
        kosdaq_latest = kosdaq_df.iloc[-1]

        # 등락률 계산 (전일 대비)
        kospi_prev  = kospi_df.iloc[-2]["종가"] if len(kospi_df) >= 2 else kospi_latest["종가"]
        kosdaq_prev = kosdaq_df.iloc[-2]["종가"] if len(kosdaq_df) >= 2 else kosdaq_latest["종가"]

        kospi_chg  = (kospi_latest["종가"]  - kospi_prev)  / kospi_prev  * 100
        kosdaq_chg = (kosdaq_latest["종가"] - kosdaq_prev) / kosdaq_prev * 100

        # 거래대금
        kospi_vol  = _fmt_volume(float(kospi_latest.get("거래대금", 0)))
        kosdaq_vol = _fmt_volume(float(kosdaq_latest.get("거래대금", 0)))

        # 전체 시장 외국인·기관 수급 (KOSPI)
        try:
            inv_df = stock.get_market_trading_value_by_date(start, end, "KOSPI")
            if not inv_df.empty:
                last_inv = inv_df.iloc[-1]
                foreign_net = _fmt_net(float(last_inv.get("외국인합계", 0)))
                inst_net    = _fmt_net(float(last_inv.get("기관합계", 0)))
            else:
                foreign_net = inst_net = "—"
        except Exception:
            foreign_net = inst_net = "—"

        return KoreanMarket(
            kospi_index=float(kospi_latest["종가"]),
            kospi_change=round(kospi_chg, 2),
            kosdaq_index=float(kosdaq_latest["종가"]),
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
