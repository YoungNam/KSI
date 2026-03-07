"""
stock_picker.py — 특징주 스캔 및 종목 선정

조건:
  - 등락률 ±5% 이상
  - 거래량 전일 대비 200% 이상

스캔 결과를 StockCandidate 리스트로 반환합니다.
pykrx 실패 시 FinanceDataReader로 fallback합니다.

공개 인터페이스:
  scan_featured_stocks(market, top_n) → list[StockCandidate]
  scan_by_tickers(tickers)           → list[StockCandidate]
"""
from __future__ import annotations

from datetime import datetime, timedelta

from models import StockCandidate


# 등락률·거래량 필터 기준
_CHANGE_THRESHOLD  = 5.0    # ±5% 이상
_VOLUME_MULTIPLIER = 2.0    # 전일 거래량 200% 이상


def _recent_dates(days: int = 5) -> tuple[str, str]:
    today = datetime.today()
    start = today - timedelta(days=days)
    return start.strftime("%Y%m%d"), today.strftime("%Y%m%d")


def _latest_trading_date(market: str = "KOSPI") -> str:
    """
    당일 데이터가 없는 경우(장 마감·주말·공휴일) 가장 최근 거래일 날짜 문자열 반환.
    pykrx 실패 시 FDR로 fallback.
    """
    # pykrx 시도
    try:
        from pykrx import stock
        for offset in range(0, 10):
            d = (datetime.today() - timedelta(days=offset)).strftime("%Y%m%d")
            try:
                df = stock.get_market_ohlcv(d, market=market)
                if not df.empty:
                    return d
            except Exception:
                continue
    except ImportError:
        pass

    # FDR fallback — 인덱스 데이터로 최근 거래일 확인
    try:
        import FinanceDataReader as fdr
        symbol = "^KS11" if market == "KOSPI" else "^KQ11"
        start = (datetime.today() - timedelta(days=15)).strftime("%Y-%m-%d")
        end = datetime.today().strftime("%Y-%m-%d")
        df = fdr.DataReader(symbol, start, end)
        if not df.empty:
            return df.index[-1].strftime("%Y%m%d")
    except Exception:
        pass

    return datetime.today().strftime("%Y%m%d")


def _action_from_change(change: float) -> str:
    """등락률로 기본 매매 방향 판단"""
    if change >= 5:
        return "관망"   # 급등 → 추격 매수 자제
    if change <= -5:
        return "관망"   # 급락 → 저가 매수 검토 전 관망
    return "관망"


def _reason_from_stats(name: str, change: float, vol_ratio: float) -> str:
    direction = "급등" if change > 0 else "급락"
    return (
        f"{direction} {abs(change):.1f}%, 거래량 전일 대비 {vol_ratio:.0f}배 "
        f"— 단기 변동성 확대, 추세 확인 후 진입 검토"
    )


# ────────────────────────────────────────────────
# 공개 인터페이스
# ────────────────────────────────────────────────

def _scan_with_pykrx(market: str, top_n: int) -> list[StockCandidate]:
    """pykrx 기반 시장 전체 스캔 (pkg_resources 오류 발생 가능)"""
    from pykrx import stock

    markets = ["KOSPI", "KOSDAQ"] if market == "ALL" else [market]
    candidates: list[StockCandidate] = []

    for mkt in markets:
        today_str = _latest_trading_date(mkt)
        df = stock.get_market_ohlcv(today_str, market=mkt)

        if df.empty:
            continue

        change_col = "등락률" if "등락률" in df.columns else None
        vol_col    = "거래량" if "거래량" in df.columns else "Volume"

        if change_col is None:
            continue

        filtered = df[df[change_col].abs() >= _CHANGE_THRESHOLD].copy()

        # 전일 거래량 비교용 데이터
        for back in range(1, 6):
            prev_str = (datetime.today() - timedelta(days=back)).strftime("%Y%m%d")
            if prev_str < today_str:
                break
        prev_df = stock.get_market_ohlcv(prev_str, market=mkt)

        for ticker in filtered.index[:top_n]:
            row    = filtered.loc[ticker]
            change = float(row[change_col])
            cur_vol = float(row[vol_col])

            vol_ratio = 1.0
            if not prev_df.empty and ticker in prev_df.index:
                prev_vol = float(prev_df.loc[ticker, vol_col])
                if prev_vol > 0:
                    vol_ratio = cur_vol / prev_vol

            if vol_ratio < _VOLUME_MULTIPLIER:
                continue

            try:
                name = stock.get_market_ticker_name(ticker)
            except Exception:
                name = ticker

            candidates.append(StockCandidate(
                name=name, ticker=ticker,
                action=_action_from_change(change),
                reason=_reason_from_stats(name, change, vol_ratio),
                target=None, stop=None,
            ))

    return candidates[:top_n]


_MAJOR_KOSPI = [
    "005930", "000660", "373220", "207940", "005935", "006400", "005380",
    "000270", "068270", "035420", "035720", "105560", "055550", "012330",
    "003670", "028260", "066570", "051910", "096770", "034730",
    "032830", "003490", "009150", "018260", "086790", "010130", "011200",
    "017670", "316140", "033780", "034020", "030200", "015760", "047050",
]
_MAJOR_KOSDAQ = [
    "247540", "403870", "196170", "112040", "086520", "041510", "145020",
    "263750", "035900", "328130", "099190", "357780", "091990", "383310",
    "293490", "036930", "067630", "240810", "137310", "257720",
]


def _scan_with_fdr(market: str, top_n: int) -> list[StockCandidate]:
    """FDR 기반 fallback 스캔 — 주요 종목 중 등락률·거래량 필터"""
    import FinanceDataReader as fdr
    from data.market_data import get_stock_name

    # StockListing 시도, 실패 시 주요 종목 리스트 사용
    ticker_list: list[str] = []
    markets = ["KOSPI", "KOSDAQ"] if market == "ALL" else [market]

    for mkt in markets:
        try:
            listing = fdr.StockListing(mkt)
            if "Marcap" in listing.columns:
                top = listing.sort_values("Marcap", ascending=False).head(80)
                for _, row in top.iterrows():
                    code = str(row.get("Code", row.get("Symbol", "")))
                    if code and len(code) == 6:
                        ticker_list.append(code)
            else:
                raise ValueError("Marcap 컬럼 없음")
        except Exception:
            # fallback: 주요 종목 하드코딩
            if mkt == "KOSPI":
                ticker_list.extend(_MAJOR_KOSPI)
            else:
                ticker_list.extend(_MAJOR_KOSDAQ)

    candidates: list[StockCandidate] = []
    end   = datetime.today().strftime("%Y-%m-%d")
    start = (datetime.today() - timedelta(days=10)).strftime("%Y-%m-%d")

    for ticker in ticker_list:
        try:
            df = fdr.DataReader(ticker, start, end)
            if df.empty or len(df) < 2:
                continue

            close_today = float(df["Close"].iloc[-1])
            close_prev  = float(df["Close"].iloc[-2])
            if close_prev == 0:
                continue

            change = (close_today - close_prev) / close_prev * 100

            if abs(change) < _CHANGE_THRESHOLD:
                continue

            vol_today = float(df["Volume"].iloc[-1])
            vol_prev  = float(df["Volume"].iloc[-2])
            vol_ratio = vol_today / vol_prev if vol_prev > 0 else 1.0

            if vol_ratio < _VOLUME_MULTIPLIER:
                continue

            name = get_stock_name(ticker)
            candidates.append(StockCandidate(
                name=name, ticker=ticker,
                action=_action_from_change(change),
                reason=_reason_from_stats(name, change, vol_ratio),
                target=None, stop=None,
            ))

            if len(candidates) >= top_n:
                break
        except Exception:
            continue

    return candidates[:top_n]


def scan_featured_stocks(
    market: str = "KOSPI",
    top_n: int = 10,
) -> list[StockCandidate]:
    """
    전일 대비 등락률·거래량 급변 종목 스캔.
    pykrx 우선 시도, 실패 시 FDR fallback.
    """
    print(f"[stock_picker] {market} 특징주 스캔 시작")

    # FDR 기반 스캔 (pykrx get_market_ohlcv KRX API 호환 문제로 사용 불가)
    try:
        candidates = _scan_with_fdr(market, top_n)
        print(f"[stock_picker] FDR 스캔 완료 — {len(candidates)}종목")
        return candidates
    except Exception as e:
        print(f"[stock_picker] FDR 스캔도 실패: {e}")
        return []


def scan_by_tickers(tickers: list[str]) -> list[StockCandidate]:
    """
    지정 종목 코드 리스트에 대한 당일 데이터 조회 → StockCandidate 반환
    pykrx 실패 시 FDR fallback.
    """
    print(f"[stock_picker] 종목 상세 조회: {tickers}")

    # FDR 우선 사용 (pykrx pkg_resources 오류 회피)
    try:
        import FinanceDataReader as fdr
        from data.market_data import get_stock_name

        start = (datetime.today() - timedelta(days=10)).strftime("%Y-%m-%d")
        end   = datetime.today().strftime("%Y-%m-%d")
        results: list[StockCandidate] = []

        for ticker in tickers:
            try:
                df = fdr.DataReader(ticker, start, end)
                if df.empty or len(df) < 2:
                    continue

                close  = float(df["Close"].iloc[-1])
                prev   = float(df["Close"].iloc[-2])
                change = (close - prev) / prev * 100 if prev > 0 else 0.0
                name   = get_stock_name(ticker)

                results.append(StockCandidate(
                    name=name, ticker=ticker,
                    action=_action_from_change(change),
                    reason=f"당일 {'+' if change >= 0 else ''}{change:.1f}%",
                ))
            except Exception:
                continue

        return results

    except Exception as e:
        print(f"[stock_picker] FDR 종목 조회 실패: {e}")
        return []
