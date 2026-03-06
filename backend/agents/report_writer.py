"""
report_writer.py — 4종 브리핑 리포트 생성 모듈

브리핑 유형:
  MORNING  → 07:00 KST (모닝 브리핑)
  OPEN     → 09:10 KST (장 초반 업데이트)
  CLOSE    → 16:10 KST (장 마감 리포트)
  EVENING  → 21:00 KST (이브닝 브리핑)
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from pathlib import Path
from typing import Optional

# 리포트 저장 디렉토리 (backend/reports/)
REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)


# ────────────────────────────────────────────────
# 데이터 모델
# ────────────────────────────────────────────────

class BriefingType(str, Enum):
    MORNING = "morning"   # 07:00 모닝
    OPEN    = "open"      # 09:10 장 초반
    CLOSE   = "close"     # 16:10 장 마감
    EVENING = "evening"   # 21:00 이브닝


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
class BriefingContext:
    """브리핑 생성에 필요한 전체 컨텍스트"""
    report_date:    date
    briefing_type:  BriefingType

    # 시장 데이터 (유형별로 필요한 항목만 채움)
    global_market:  GlobalMarket   = field(default_factory=GlobalMarket)
    korean_market:  KoreanMarket   = field(default_factory=KoreanMarket)

    # 뉴스·이슈
    news_items:     list[NewsItem]        = field(default_factory=list)

    # 관심 종목 및 전략
    stocks:         list[StockCandidate]  = field(default_factory=list)
    strategy_json:  dict                  = field(default_factory=dict)

    # 추가 텍스트 (에이전트가 자유 형식으로 채움)
    market_outlook: str = ""    # 시장 전망 서술
    key_message:    str = ""    # 핵심 한줄 메시지
    tomorrow_events: list[str] = field(default_factory=list)  # 익일 주요 일정


# ────────────────────────────────────────────────
# 유틸리티
# ────────────────────────────────────────────────

def _sign(value: float) -> str:
    """양수면 +, 음수면 - 기호 반환"""
    return "+" if value >= 0 else ""


def _impact_icon(impact: str) -> str:
    return {"높음": "🔴", "중간": "🟡", "낮음": "🟢"}.get(impact, "⚪")


def _action_icon(action: str) -> str:
    return {"매수": "▲", "관망": "◆", "매도": "▼"}.get(action, "—")


def _kr_date(d: date) -> str:
    weekdays = "월화수목금토일"
    return f"{d.strftime('%Y-%m-%d')} ({weekdays[d.weekday()]})"


# ────────────────────────────────────────────────
# 4종 브리핑 템플릿
# ────────────────────────────────────────────────

def _morning_template(ctx: BriefingContext) -> str:
    """
    [모닝 브리핑] 07:00 KST
    구성: 글로벌 시장 동향 → 주요 이슈 → 오늘의 전망 → 관심 종목 → 투자 전략
    """
    g = ctx.global_market
    k = ctx.korean_market
    strat = ctx.strategy_json

    # 글로벌 시장 테이블
    global_table = f"""\
| 지표 | 현재가 | 등락률 |
|------|--------|--------|
| S&P 500 | {g.sp500_price:,.2f} | {_sign(g.sp500_change)}{g.sp500_change:.2f}% |
| NASDAQ | {g.nasdaq_price:,.2f} | {_sign(g.nasdaq_change)}{g.nasdaq_change:.2f}% |
| 달러/원 | {g.usd_krw:,.0f} | {_sign(g.usd_krw_change)}{g.usd_krw_change:.1f}원 |
| WTI 원유 | ${g.wti_price:.2f} | {_sign(g.wti_change)}{g.wti_change:.2f}% |
| 금 현물 | ${g.gold_price:,.0f} | {_sign(g.gold_change)}{g.gold_change:.2f}% |
| 미국 10Y | {g.us10y_yield:.2f}% | — |"""

    # 뉴스 섹션
    news_lines = "\n".join(
        f"- {_impact_icon(n.impact)} **[{n.impact}]** {n.title}  \n  {n.summary}"
        + (f"  \n  관련 섹터: {', '.join(n.sectors)}" if n.sectors else "")
        for n in sorted(ctx.news_items, key=lambda x: {"높음": 0, "중간": 1, "낮음": 2}.get(x.impact, 3))
    ) or "수집된 이슈 없음"

    # 관심 종목 테이블 (관심종목 태그 여부로 ★ 아이콘 추가)
    def _stock_row(s) -> str:
        is_watchlist = s.reason.startswith("[관심종목]")
        icon = f"★ {_action_icon(s.action)}" if is_watchlist else _action_icon(s.action)
        reason = s.reason.replace("[관심종목] ", "")
        reason_str = reason[:38] + "…" if len(reason) > 38 else reason
        return f"| {icon} {s.name} | {s.ticker} | {s.action} | {reason_str} |"

    stock_rows = "\n".join(_stock_row(s) for s in ctx.stocks[:8]) or "| — | — | — | — |"

    # 투자 전략 요약
    phase     = strat.get("market_phase", "—")
    stance    = strat.get("overall_stance", "—")
    score     = strat.get("market_score", "—")
    risk_note = strat.get("risk_management", {}).get("notes", "—")
    summary   = strat.get("summary", ctx.market_outlook)
    NL        = "\n"

    return f"""\
# [모닝 브리핑] KSI Daily — {_kr_date(ctx.report_date)}
> 생성 시각: 07:00 KST | Korean Stock Intelligence

---

## 1. 글로벌 시장 동향 (전일 마감)

{global_table}

---

## 2. 글로벌 주요 이슈

{news_lines}

---

## 3. 오늘의 한국 시장 전망

{ctx.market_outlook or "시장 전망 데이터 없음"}

> 💡 **핵심 메시지**: {ctx.key_message or "—"}

---

## 4. 장 전 관심 종목 (TOP {min(8, len(ctx.stocks))}) ★=관심종목

| 종목 | 코드 | 방향 | 선정 이유 |
|------|------|------|-----------|
{stock_rows}

---

## 5. 오늘의 투자 전략

- **시장 국면**: {phase} (시장점수 {score})
- **포지션 기조**: {stance}
- **리스크 관리**: {risk_note}

> {summary}

---
*KSI — Korean Stock Intelligence | 본 브리핑은 투자 참고용이며 투자 손실에 대한 책임을 지지 않습니다.*
"""


def _open_template(ctx: BriefingContext) -> str:
    """
    [장 초반 업데이트] 09:10 KST
    구성: 개장 현황 → 특징주 → 외국인·기관 초반 동향 → 단기 매매 포인트
    """
    k = ctx.korean_market

    news_lines = "\n".join(
        f"- {_impact_icon(n.impact)} {n.title} — {n.summary}"
        for n in ctx.news_items[:5]
    ) or "없음"

    stock_rows = "\n".join(
        f"| {_action_icon(s.action)} {s.name} | {s.ticker} | {s.action} | {s.reason} |"
        for s in ctx.stocks[:5]
    ) or "| — | — | — | — |"

    return f"""\
# [장 초반 업데이트] KSI — {_kr_date(ctx.report_date)}
> 생성 시각: 09:10 KST | 개장 후 10분 시황

---

## 1. 개장 현황

| 지수 | 현재 | 등락률 | 거래대금 |
|------|------|--------|---------|
| KOSPI | {k.kospi_index:,.2f} | {_sign(k.kospi_change)}{k.kospi_change:.2f}% | {k.kospi_volume} |
| KOSDAQ | {k.kosdaq_index:,.2f} | {_sign(k.kosdaq_change)}{k.kosdaq_change:.2f}% | {k.kosdaq_volume} |

---

## 2. 외국인·기관 초반 수급

| 주체 | 순매수 방향 |
|------|------------|
| 외국인 | {k.foreign_net} |
| 기관 | {k.institution_net} |

---

## 3. 장 초반 특징주·급등락

| 종목 | 코드 | 방향 | 사유 |
|------|------|------|------|
{stock_rows}

---

## 4. 장중 이슈

{news_lines}

---

## 5. 단기 매매 포인트

{ctx.market_outlook or "장 초반 변동성 확인 중 — 15분봉 추세 확립 후 진입 권장"}

> 💡 {ctx.key_message or "급등 초기 추격 매수 자제, 눌림목 진입 우선"}

---
*KSI — Korean Stock Intelligence | 09:10 KST 기준 장 초반 데이터*
"""


def _close_template(ctx: BriefingContext) -> str:
    """
    [장 마감 리포트] 16:10 KST
    구성: 마감 현황 → 수급 결산 → 섹터별 동향 → 종목 결산 → 내일을 위한 포인트
    """
    k = ctx.korean_market
    strat = ctx.strategy_json

    news_lines = "\n".join(
        f"- {_impact_icon(n.impact)} {n.title}"
        for n in ctx.news_items[:5]
    ) or "없음"

    stock_rows = "\n".join(
        f"| {s.name} | {s.ticker} | {s.action} | {s.reason} |"
        for s in ctx.stocks[:5]
    ) or "| — | — | — | — |"

    summary = strat.get("summary", ctx.market_outlook) or "—"
    # f-string 내 백슬래시 금지 우회용 변수
    nl = "\n"
    tomorrow_section = (
        "**내일 주요 일정:**" + nl + nl.join(f"- {e}" for e in ctx.tomorrow_events)
        if ctx.tomorrow_events else ""
    )

    return f"""\
# [장 마감 리포트] KSI — {_kr_date(ctx.report_date)}
> 생성 시각: 16:10 KST | 당일 결산

---

## 1. 마감 현황

| 지수 | 종가 | 등락률 | 거래대금 |
|------|------|--------|---------|
| KOSPI | {k.kospi_index:,.2f} | {_sign(k.kospi_change)}{k.kospi_change:.2f}% | {k.kospi_volume} |
| KOSDAQ | {k.kosdaq_index:,.2f} | {_sign(k.kosdaq_change)}{k.kosdaq_change:.2f}% | {k.kosdaq_volume} |

---

## 2. 외국인·기관 수급 결산

| 주체 | 순매수 |
|------|--------|
| 외국인 | {k.foreign_net} |
| 기관 | {k.institution_net} |

---

## 3. 당일 주요 이슈 & 섹터 동향

{news_lines}

---

## 4. 관심 종목 결산

| 종목 | 코드 | 결과 | 비고 |
|------|------|------|------|
{stock_rows}

---

## 5. 오늘의 총평 & 내일을 위한 포인트

{summary}

{tomorrow_section}

---
*KSI — Korean Stock Intelligence | 16:10 KST 기준 당일 최종 데이터*
"""


def _evening_template(ctx: BriefingContext) -> str:
    """
    [이브닝 브리핑] 21:00 KST
    구성: 미국 장 개장 현황 → 글로벌 이슈 → 익일 이벤트 → 익일 전략 방향
    """
    g = ctx.global_market

    news_lines = "\n".join(
        f"- {_impact_icon(n.impact)} **[{n.impact}]** {n.title}  \n  {n.summary}"
        + (f"  \n  한국 영향 섹터: {', '.join(n.sectors)}" if n.sectors else "")
        for n in sorted(ctx.news_items, key=lambda x: {"높음": 0, "중간": 1, "낮음": 2}.get(x.impact, 3))
    ) or "수집된 이슈 없음"

    events_lines = "\n".join(f"- {e}" for e in ctx.tomorrow_events) or "- 특이 일정 없음"

    strat = ctx.strategy_json
    phase  = strat.get("market_phase", "—")
    stance = strat.get("overall_stance", "—")

    return f"""\
# [이브닝 브리핑] KSI — {_kr_date(ctx.report_date)}
> 생성 시각: 21:00 KST | 미국 장 개장 전 글로벌 점검

---

## 1. 미국 장 개장 현황 (한국 시각 22:30~)

| 지표 | 현재가 | 등락률 |
|------|--------|--------|
| S&P 500 선물 | {g.sp500_price:,.2f} | {_sign(g.sp500_change)}{g.sp500_change:.2f}% |
| NASDAQ 선물 | {g.nasdaq_price:,.2f} | {_sign(g.nasdaq_change)}{g.nasdaq_change:.2f}% |
| 달러/원 | {g.usd_krw:,.0f} | {_sign(g.usd_krw_change)}{g.usd_krw_change:.1f}원 |
| WTI 원유 | ${g.wti_price:.2f} | {_sign(g.wti_change)}{g.wti_change:.2f}% |
| 금 현물 | ${g.gold_price:,.0f} | {_sign(g.gold_change)}{g.gold_change:.2f}% |
| 미국 10Y | {g.us10y_yield:.2f}% | — |

---

## 2. 글로벌 주요 이슈 (한국 시장 영향도)

{news_lines}

---

## 3. 내일 주요 이벤트·일정

{events_lines}

---

## 4. 익일 전략 방향

- **예상 시장 국면**: {phase}
- **포지션 기조**: {stance}

{ctx.market_outlook or "글로벌 이슈 소화 후 익일 장 초반 방향성 확인 필요"}

> 💡 **핵심 메시지**: {ctx.key_message or "—"}

---
*KSI — Korean Stock Intelligence | 21:00 KST 기준 글로벌 데이터*
"""


# ────────────────────────────────────────────────
# 공개 인터페이스
# ────────────────────────────────────────────────

_TEMPLATES = {
    BriefingType.MORNING: _morning_template,
    BriefingType.OPEN:    _open_template,
    BriefingType.CLOSE:   _close_template,
    BriefingType.EVENING: _evening_template,
}


def generate_briefing(ctx: BriefingContext) -> str:
    """컨텍스트를 받아 해당 유형의 Markdown 브리핑 문자열 반환"""
    template_fn = _TEMPLATES[ctx.briefing_type]
    return template_fn(ctx)


def save_briefing(ctx: BriefingContext, content: str) -> Path:
    """
    Markdown 파일로 저장.
    경로: backend/reports/{type}_{YYYY-MM-DD}.md
    반환: 저장된 파일 경로
    """
    filename = f"{ctx.briefing_type.value}_{ctx.report_date.isoformat()}.md"
    path = REPORTS_DIR / filename
    path.write_text(content, encoding="utf-8")
    print(f"[report_writer] 저장 완료: {path}")
    return path


def run_briefing(ctx: BriefingContext) -> Path:
    """generate + save 를 한 번에 실행하는 편의 함수"""
    content = generate_briefing(ctx)
    return save_briefing(ctx, content)
