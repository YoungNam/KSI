"""
market_data.py — 시장 데이터 수집

데이터 소스:
  - KRX Open API  : 거래대금 (AUTH_KEY 인증)
  - KRX 스크래핑   : 외국인·기관 순매수 (인증 불필요)
  - FDR (Yahoo)    : 지수 종가·등락률, 글로벌 시장

함수:
  fetch_korean_market()  → KoreanMarket
  fetch_global_market()  → GlobalMarket
  get_stock_name(ticker) → str  (종목명 캐시)
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta

import requests

from models import GlobalMarket, KoreanMarket


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


def _latest_trading_date() -> str:
    """최근 거래일 (YYYYMMDD) — 주말·공휴일이면 직전 평일 반환"""
    today = datetime.today()
    # 장 마감 전이면 전일 데이터 사용
    if today.hour < 16:
        today = today - timedelta(days=1)
    # 주말 보정
    while today.weekday() >= 5:  # 5=토, 6=일
        today = today - timedelta(days=1)
    return today.strftime("%Y%m%d")


# ────────────────────────────────────────────────
# KRX Open API — 거래대금 수집
# ────────────────────────────────────────────────

def _fetch_krx_volume(date: str) -> tuple[str, str]:
    """KRX Open API로 KOSPI·KOSDAQ 거래대금 수집. 실패 시 ("—", "—") 반환."""
    krx_key = os.getenv("KRX_API_KEY", "")
    if not krx_key:
        return "—", "—"

    kospi_vol = "—"
    kosdaq_vol = "—"

    endpoints = [
        ("idx/kospi_dd_trd", "코스피"),
        ("idx/kosdaq_dd_trd", "코스닥"),
    ]
    try:
        for endpoint, idx_keyword in endpoints:
            url = f"https://data-dbg.krx.co.kr/svc/apis/{endpoint}"
            r = requests.get(
                url,
                headers={"AUTH_KEY": krx_key.strip()},
                params={"basDd": date},
                timeout=10,
            )
            if r.status_code != 200:
                print(f"[market_data] KRX API {endpoint} HTTP {r.status_code}")
                continue

            items = r.json().get("OutBlock_1", [])
            # 전체 시장 거래대금 = 첫 번째 항목 (외국주포함 전체)
            total_val = 0.0
            if items:
                total_val = float(items[0].get("ACC_TRDVAL", 0))

            if "kospi" in endpoint:
                kospi_vol = _fmt_volume(total_val) if total_val > 0 else "—"
            else:
                kosdaq_vol = _fmt_volume(total_val) if total_val > 0 else "—"

        print(f"[market_data] KRX 거래대금: KOSPI={kospi_vol}, KOSDAQ={kosdaq_vol}")
    except Exception as e:
        print(f"[market_data] KRX Open API 거래대금 실패: {e}")

    return kospi_vol, kosdaq_vol


# ────────────────────────────────────────────────
# 네이버 금융 API — 외국인·기관 순매수
# ────────────────────────────────────────────────

def _fetch_investor_trading(date: str) -> tuple[str, str]:
    """네이버 금융 API로 KOSPI 외국인·기관 순매수 수집. 실패 시 ("—", "—") 반환.

    네이버 응답 단위: 억 원 (부호 포함 문자열, e.g. "+32,534", "-20,826")
    """
    foreign_net = "—"
    inst_net = "—"

    try:
        r = requests.get(
            "https://m.stock.naver.com/api/index/KOSPI/trend",
            headers={"User-Agent": "Mozilla/5.0"},
            timeout=10,
        )
        if r.status_code != 200:
            print(f"[market_data] 네이버 수급 API HTTP {r.status_code}")
            return foreign_net, inst_net

        data = r.json()
        # 응답: {"bizdate":"20260309", "personalValue":"+32,534",
        #        "foreignValue":"-20,826", "institutionalValue":"-12,224"}
        fv = data.get("foreignValue", "")
        iv = data.get("institutionalValue", "")

        if fv:
            foreign_net = f"{fv}억"
        if iv:
            inst_net = f"{iv}억"

        print(f"[market_data] 수급(네이버): 외국인={foreign_net}, 기관={inst_net}")
    except Exception as e:
        print(f"[market_data] 네이버 수급 수집 실패: {e}")

    return foreign_net, inst_net


# ────────────────────────────────────────────────
# 국내 시장 데이터 (통합)
# ────────────────────────────────────────────────

def fetch_korean_market() -> KoreanMarket:
    """KOSPI·KOSDAQ 지수 + 거래대금 + 외국인·기관 수급 수집"""
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

        # 거래대금 — KRX Open API
        trade_date = _latest_trading_date()
        kospi_vol, kosdaq_vol = _fetch_krx_volume(trade_date)

        # 외국인·기관 순매수 — KRX 스크래핑
        foreign_net, inst_net = _fetch_investor_trading(trade_date)

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
