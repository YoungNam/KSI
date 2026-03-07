"""
market_analyst.py — KOSPI·KOSDAQ 시장 분석

기술 지표(MA20/60, RSI, MACD, 볼린저밴드)를 계산하고
시장 국면(강세/횡보/약세)과 종합점수(0~100)를 산출합니다.

공개 인터페이스:
  analyze_market() → MarketAnalysis
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from agents.report_writer import GlobalMarket, KoreanMarket
from data.market_data import fetch_global_market, fetch_korean_market


# ────────────────────────────────────────────────
# 결과 구조체
# ────────────────────────────────────────────────

@dataclass
class MarketAnalysis:
    korean_market:  KoreanMarket
    global_market:  GlobalMarket
    market_score:   int    = 50       # 0~100 종합점수
    market_phase:   str    = "횡보"   # 강세 / 횡보 / 약세
    overall_stance: str    = "중립"   # 공격적 / 중립 / 방어적
    indicators:     dict   = field(default_factory=dict)  # 기술 지표 상세


# ────────────────────────────────────────────────
# 기술 지표 계산
# ────────────────────────────────────────────────

def _calc_indicators(df) -> dict:
    """
    pykrx OHLCV DataFrame → 기술 지표 딕셔너리
    필요 컬럼: 종가 (Close)
    """
    import pandas as pd

    close = df["종가"] if "종가" in df.columns else df["Close"]
    close = close.dropna()

    if len(close) < 20:
        return {}

    # MA
    ma20 = float(close.rolling(20).mean().iloc[-1])
    ma60 = float(close.rolling(60).mean().iloc[-1]) if len(close) >= 60 else None
    price = float(close.iloc[-1])

    # RSI (14일)
    delta = close.diff()
    gain  = delta.clip(lower=0).rolling(14).mean()
    loss  = (-delta.clip(upper=0)).rolling(14).mean()
    rs    = gain / loss.replace(0, 1e-9)
    rsi   = float((100 - 100 / (1 + rs)).iloc[-1])

    # MACD (12, 26, 9)
    ema12  = close.ewm(span=12, adjust=False).mean()
    ema26  = close.ewm(span=26, adjust=False).mean()
    macd   = ema12 - ema26
    signal = macd.ewm(span=9, adjust=False).mean()

    # 볼린저밴드 (20, 2σ)
    bb_mid   = close.rolling(20).mean()
    bb_std   = close.rolling(20).std()
    bb_upper = float((bb_mid + 2 * bb_std).iloc[-1])
    bb_lower = float((bb_mid - 2 * bb_std).iloc[-1])

    return {
        "price":    price,
        "ma20":     ma20,
        "ma60":     ma60,
        "rsi":      round(rsi, 2),
        "macd":     round(float(macd.iloc[-1]), 2),
        "signal":   round(float(signal.iloc[-1]), 2),
        "bb_upper": round(bb_upper, 2),
        "bb_lower": round(bb_lower, 2),
    }


def _score_market(kospi_ind: dict, kospi_chg: float, kosdaq_chg: float,
                  foreign_net: str) -> tuple[int, str, str]:
    """
    기술 지표 + 등락률 + 수급 → 시장점수(0~100), 국면, 기조
    """
    score = 50  # 기본값

    if kospi_ind:
        price = kospi_ind.get("price", 0)
        ma20  = kospi_ind.get("ma20", 0)
        ma60  = kospi_ind.get("ma60")
        rsi   = kospi_ind.get("rsi", 50)
        macd  = kospi_ind.get("macd", 0)
        sig   = kospi_ind.get("signal", 0)

        # MA 위치 (+10 / -10)
        if ma20 and price > ma20:  score += 10
        if ma20 and price < ma20:  score -= 10
        if ma60 and price > ma60:  score += 5
        if ma60 and price < ma60:  score -= 5

        # RSI 구간
        if 40 <= rsi <= 60:    score += 5
        elif rsi > 70:         score -= 5   # 과매수
        elif rsi < 30:         score -= 10  # 과매도

        # MACD 골든/데드 크로스
        if macd > sig:   score += 8
        else:            score -= 8

    # 당일 등락률 반영
    score += int(kospi_chg * 2)
    score += int(kosdaq_chg * 1)

    # 외국인 수급 (+5 / -5)
    if "+" in str(foreign_net):  score += 5
    elif "-" in str(foreign_net): score -= 5

    score = max(0, min(100, score))

    if score >= 70:
        phase, stance = "강세", "공격적"
    elif score >= 45:
        phase, stance = "횡보", "중립"
    else:
        phase, stance = "약세", "방어적"

    return score, phase, stance


# ────────────────────────────────────────────────
# 공개 인터페이스
# ────────────────────────────────────────────────

def analyze_market() -> MarketAnalysis:
    """국내+글로벌 데이터 수집 → 지표 계산 → MarketAnalysis 반환"""
    print("[market_analyst] 시장 분석 시작")

    korean = fetch_korean_market()
    global_ = fetch_global_market()

    # KOSPI 기술 지표 계산 (과거 60일치 필요) — FDR (Yahoo Finance)
    indicators: dict = {}
    try:
        import FinanceDataReader as fdr
        start_fdr = (datetime.today() - timedelta(days=90)).strftime("%Y-%m-%d")
        end_fdr   = datetime.today().strftime("%Y-%m-%d")
        kospi_df = fdr.DataReader("^KS11", start_fdr, end_fdr)
        if not kospi_df.empty:
            indicators = _calc_indicators(kospi_df)
    except Exception as e:
        print(f"[market_analyst] 기술 지표 계산 실패: {e}")

    score, phase, stance = _score_market(
        indicators,
        korean.kospi_change,
        korean.kosdaq_change,
        korean.foreign_net,
    )

    print(f"[market_analyst] 완료 — 점수:{score} 국면:{phase} 기조:{stance}")
    return MarketAnalysis(
        korean_market=korean,
        global_market=global_,
        market_score=score,
        market_phase=phase,
        overall_stance=stance,
        indicators=indicators,
    )
