"""
stock_picker.py — 특징주 스캔 및 종목 선정

조건:
  - 등락률 ±5% 이상
  - 거래량 전일 대비 200% 이상

스캔 결과를 StockCandidate 리스트로 반환합니다.

공개 인터페이스:
  scan_featured_stocks(market, top_n) → list[StockCandidate]
  scan_by_tickers(tickers)           → list[StockCandidate]
"""
from __future__ import annotations

from datetime import datetime, timedelta

from agents.report_writer import StockCandidate


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
    최근 10일 내에서 거슬러 올라가며 탐색합니다.
    """
    from pykrx import stock
    for offset in range(0, 10):
        d = (datetime.today() - timedelta(days=offset)).strftime("%Y%m%d")
        try:
            df = stock.get_market_ohlcv(d, market=market)
            if not df.empty:
                return d
        except Exception:
            continue
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

def scan_featured_stocks(
    market: str = "KOSPI",
    top_n: int = 10,
) -> list[StockCandidate]:
    """
    pykrx 로 전일 대비 등락률·거래량 급변 종목 스캔

    market : "KOSPI" | "KOSDAQ" | "ALL"
    top_n  : 최대 반환 종목 수
    """
    print(f"[stock_picker] {market} 특징주 스캔 시작")
    try:
        from pykrx import stock

        start, end = _recent_dates(10)
        markets = ["KOSPI", "KOSDAQ"] if market == "ALL" else [market]

        candidates: list[StockCandidate] = []

        for mkt in markets:
            # 장 마감·주말 대응: 가장 최근 거래일 탐색
            today_str = _latest_trading_date(mkt)
            df = stock.get_market_ohlcv(today_str, market=mkt)

            if df.empty:
                continue

            # 컬럼 확인 (pykrx 버전에 따라 다름)
            change_col = "등락률" if "등락률" in df.columns else None
            vol_col    = "거래량" if "거래량" in df.columns else "Volume"

            if change_col is None:
                continue

            # 등락률 필터 (절댓값 ≥ threshold)
            filtered = df[df[change_col].abs() >= _CHANGE_THRESHOLD].copy()

            # 거래량 비율 계산 (전일 대비 — 직전 거래일 탐색)
            for back in range(1, 6):
                prev_str = (datetime.today() - timedelta(days=back)).strftime("%Y%m%d")
                if prev_str < today_str:  # today_str이 이미 과거일 수 있으므로 비교
                    break
            prev_df  = stock.get_market_ohlcv(prev_str, market=mkt)

            for ticker in filtered.index[:top_n]:
                row      = filtered.loc[ticker]
                change   = float(row[change_col])
                cur_vol  = float(row[vol_col])

                # 전일 거래량 조회
                vol_ratio = 1.0
                if not prev_df.empty and ticker in prev_df.index:
                    prev_vol = float(prev_df.loc[ticker, vol_col])
                    if prev_vol > 0:
                        vol_ratio = cur_vol / prev_vol

                if vol_ratio < _VOLUME_MULTIPLIER:
                    continue

                # 종목명 조회
                try:
                    name = stock.get_market_ticker_name(ticker)
                except Exception:
                    name = ticker

                candidates.append(StockCandidate(
                    name=name,
                    ticker=ticker,
                    action=_action_from_change(change),
                    reason=_reason_from_stats(name, change, vol_ratio),
                    target=None,
                    stop=None,
                ))

        # 등락률 절댓값 기준 내림차순 정렬 후 top_n 반환
        print(f"[stock_picker] 스캔 완료 — {len(candidates)}종목")
        return candidates[:top_n]

    except Exception as e:
        print(f"[stock_picker] 스캔 실패: {e}")
        return []


def scan_by_tickers(tickers: list[str]) -> list[StockCandidate]:
    """
    지정 종목 코드 리스트에 대한 당일 데이터 조회 → StockCandidate 반환
    (strategy-generator가 선정한 종목을 상세화할 때 사용)
    """
    print(f"[stock_picker] 종목 상세 조회: {tickers}")
    try:
        from pykrx import stock

        today_str = datetime.today().strftime("%Y%m%d")
        results: list[StockCandidate] = []

        for ticker in tickers:
            try:
                name = stock.get_market_ticker_name(ticker)
                # 단일 종목 OHLCV: fromdate, todate, ticker 세 인수 필요
                df = stock.get_market_ohlcv(today_str, today_str, ticker)

                # 당일 데이터 없으면 최근 5거래일 중 가장 최근일로 fallback
                if df.empty:
                    for back in range(1, 6):
                        prev = (datetime.today() - timedelta(days=back)).strftime("%Y%m%d")
                        df = stock.get_market_ohlcv(prev, prev, ticker)
                        if not df.empty:
                            break

                if df.empty:
                    continue

                close_col  = "종가"  if "종가"  in df.columns else "Close"
                change_col = "등락률" if "등락률" in df.columns else None

                close  = float(df[close_col].iloc[-1])
                change = float(df[change_col].iloc[-1]) if change_col else 0.0

                results.append(StockCandidate(
                    name=name,
                    ticker=ticker,
                    action=_action_from_change(change),
                    reason=f"당일 {'+' if change >= 0 else ''}{change:.1f}%",
                ))
            except Exception:
                continue

        return results

    except Exception as e:
        print(f"[stock_picker] 종목 조회 실패: {e}")
        return []
