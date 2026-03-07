"""
models.py — 공유 데이터 모델

에이전트·스케줄러·데이터 수집 모듈에서 공통으로 사용하는 dataclass 정의.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GlobalMarket:
    """글로벌 시장 지표"""
    sp500_price:   float = 0.0
    sp500_change:  float = 0.0   # %
    nasdaq_price:  float = 0.0
    nasdaq_change: float = 0.0   # %
    usd_krw:       float = 0.0
    usd_krw_change: float = 0.0  # %
    wti_price:     float = 0.0
    wti_change:    float = 0.0   # %
    gold_price:    float = 0.0
    gold_change:   float = 0.0   # %
    us10y_yield:   float = 0.0   # %


@dataclass
class KoreanMarket:
    """국내 시장 지표"""
    kospi_index:    float = 0.0
    kospi_change:   float = 0.0   # %
    kosdaq_index:   float = 0.0
    kosdaq_change:  float = 0.0   # %
    kospi_volume:   str   = "—"   # 예: "8.5조"
    kosdaq_volume:  str   = "—"
    foreign_net:    str   = "—"   # 외국인 순매수 예: "+2,345억"
    institution_net: str  = "—"   # 기관 순매수


@dataclass
class NewsItem:
    """뉴스·이슈 단건"""
    impact:  str   # "높음" | "중간" | "낮음"
    title:   str
    summary: str
    sectors: list[str] = field(default_factory=list)   # 관련 섹터


@dataclass
class StockCandidate:
    """관심 종목"""
    name:    str
    ticker:  str
    action:  str   # "매수" | "관망" | "매도"
    reason:  str
    target:  Optional[float] = None   # 목표가
    stop:    Optional[float] = None   # 손절가


@dataclass
class MarketAnalysis:
    """시장 분석 결과"""
    korean_market:  KoreanMarket
    global_market:  GlobalMarket
    market_score:   int    = 50       # 0~100 종합점수
    market_phase:   str    = "횡보"   # 강세 / 횡보 / 약세
    overall_stance: str    = "중립"   # 공격적 / 중립 / 방어적
    indicators:     dict   = field(default_factory=dict)  # 기술 지표 상세
