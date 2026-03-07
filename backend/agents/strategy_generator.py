"""
strategy_generator.py — Claude API 기반 투자 전략 생성

MarketAnalysis + NewsItem 리스트 + StockCandidate 리스트를 받아
JSON 형식 투자 전략을 생성하고 backend/reports/ 에 저장합니다.

출력 형식 (strategy_YYYY-MM-DD.json):
  {
    "strategy_date": "...",
    "market_phase": "강세|횡보|약세",
    "market_score": 0~100,
    "overall_stance": "공격적|중립|방어적",
    "position_weights": {"aggressive": %, "neutral": %, "defensive": %},
    "short_term": { "period": "1~3일", "approach": "...", "key_stocks": [...] },
    "mid_term":   { "period": "1~2주",  "approach": "...", "key_stocks": [...] },
    "risk_management": { "max_loss_per_trade": "...", "portfolio_stop_loss": "...", "notes": "..." },
    "summary": "..."
  }

공개 인터페이스:
  generate_strategy(analysis, news_items, stocks) → dict
  save_strategy(strategy_dict, date)              → Path
  run_strategy(analysis, news_items, stocks)      → dict
"""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime
from pathlib import Path

from models import MarketAnalysis, NewsItem, StockCandidate

REPORTS_DIR = Path(__file__).parent.parent / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

_MODEL = "claude-sonnet-4-6"


# ────────────────────────────────────────────────
# 프롬프트 빌더
# ────────────────────────────────────────────────

def _build_prompt(analysis: MarketAnalysis, news: list[NewsItem], stocks: list[StockCandidate]) -> str:
    k = analysis.korean_market
    g = analysis.global_market
    ind = analysis.indicators

    news_text = "\n".join(
        f"- [{n.impact}] {n.title}: {n.summary} (섹터: {', '.join(n.sectors)})"
        for n in news
    ) or "뉴스 없음"

    stocks_text = "\n".join(
        f"- {s.name}({s.ticker}): 방향={s.action}, 이유={s.reason}"
        for s in stocks
    ) or "스캔 종목 없음"

    ind_text = (
        f"MA20={ind.get('ma20', 0):,.0f}, MA60={ind.get('ma60', '미계산')}, "
        f"RSI={ind.get('rsi', 0)}, MACD={ind.get('macd', 0)}(시그널:{ind.get('signal', 0)})"
    ) if ind else "기술 지표 미계산"

    today = date.today().isoformat()

    return f"""당신은 KOSPI·KOSDAQ 전문 투자 전략가입니다.
아래 시장 데이터를 분석해 오늘({today})의 투자 전략을 JSON으로 생성하세요.

## 국내 시장 현황
- KOSPI: {k.kospi_index:,.2f} ({'+' if k.kospi_change >= 0 else ''}{k.kospi_change:.2f}%)
- KOSDAQ: {k.kosdaq_index:,.2f} ({'+' if k.kosdaq_change >= 0 else ''}{k.kosdaq_change:.2f}%)
- 외국인 수급: {k.foreign_net} | 기관 수급: {k.institution_net}
- 기술 지표(KOSPI): {ind_text}

## 글로벌 시장 현황
- S&P500: {g.sp500_price:,.2f} ({'+' if g.sp500_change >= 0 else ''}{g.sp500_change:.2f}%)
- NASDAQ: {g.nasdaq_price:,.2f} ({'+' if g.nasdaq_change >= 0 else ''}{g.nasdaq_change:.2f}%)
- 달러/원: {g.usd_krw:,.0f}원
- WTI: ${g.wti_price:.2f} | 금: ${g.gold_price:,.0f}

## 시장 분석 결과
- 시장 국면: {analysis.market_phase} (점수: {analysis.market_score}/100)
- 전반 기조: {analysis.overall_stance}

## 오늘의 주요 이슈
{news_text}

## 특징주 스캔 결과
{stocks_text}

---
아래 JSON 형식으로만 응답하세요 (설명 텍스트 없이):

{{
  "strategy_date": "{today}",
  "market_phase": "{analysis.market_phase}",
  "market_score": {analysis.market_score},
  "overall_stance": "{analysis.overall_stance}",
  "position_weights": {{
    "aggressive": 30,
    "neutral": 50,
    "defensive": 20
  }},
  "short_term": {{
    "period": "1~3일",
    "approach": "단기 전략 서술 (100자 이내)",
    "key_stocks": [
      {{
        "ticker": "종목코드",
        "name": "종목명",
        "action": "매수 또는 관망 또는 매도",
        "target_price": 0,
        "stop_loss": 0,
        "risk_level": "높음 또는 중간 또는 낮음",
        "reason": "근거 (50자 이내)"
      }}
    ]
  }},
  "mid_term": {{
    "period": "1~2주",
    "approach": "중기 전략 서술 (100자 이내)",
    "key_stocks": []
  }},
  "risk_management": {{
    "max_loss_per_trade": "2%",
    "portfolio_stop_loss": "5%",
    "notes": "리스크 관리 지침 (80자 이내)"
  }},
  "summary": "오늘의 전략 핵심 요약 (150자 이내)"
}}

position_weights 합계는 반드시 100이어야 합니다.
key_stocks는 각 기간별 최대 3개, 실제 시장 데이터 기반으로 선정하세요.
"""


# ────────────────────────────────────────────────
# 공개 인터페이스
# ────────────────────────────────────────────────

def generate_strategy(
    analysis: MarketAnalysis,
    news_items: list[NewsItem],
    stocks: list[StockCandidate],
) -> dict:
    """Claude API 호출 → 전략 딕셔너리 반환"""
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise EnvironmentError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")

    import anthropic
    client = anthropic.Anthropic(api_key=api_key)

    prompt = _build_prompt(analysis, news_items, stocks)
    print(f"[strategy_generator] Claude API 호출 중 (model={_MODEL})")

    message = client.messages.create(
        model=_MODEL,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text
    # 코드블록 제거
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()

    try:
        strategy = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"[strategy_generator] JSON 파싱 실패: {e}\n원문: {raw[:200]}")
        # 파싱 실패 시 기본 구조 반환
        strategy = {
            "strategy_date": date.today().isoformat(),
            "market_phase": analysis.market_phase,
            "market_score": analysis.market_score,
            "overall_stance": analysis.overall_stance,
            "summary": "전략 생성 중 JSON 파싱 오류 발생",
        }

    print(f"[strategy_generator] 전략 생성 완료 — 국면:{strategy.get('market_phase')}")
    return strategy


def save_strategy(strategy: dict, target_date: date | None = None) -> Path:
    """전략 딕셔너리를 JSON 파일로 저장"""
    d = target_date or date.today()
    path = REPORTS_DIR / f"strategy_{d.isoformat()}.json"
    path.write_text(json.dumps(strategy, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[strategy_generator] 저장 완료: {path}")
    return path


def run_strategy(
    analysis: MarketAnalysis,
    news_items: list[NewsItem],
    stocks: list[StockCandidate],
) -> dict:
    """generate + save 편의 함수"""
    strategy = generate_strategy(analysis, news_items, stocks)
    save_strategy(strategy)
    return strategy
