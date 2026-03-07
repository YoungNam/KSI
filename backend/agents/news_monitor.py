"""
news_monitor.py — Gemini API 기반 글로벌·국내 뉴스 수집

Gemini API로 오늘의 주요 이슈를 수집하고
한국 시장 영향도(높음/중간/낮음) + 관련 섹터를 태깅합니다.

공개 인터페이스:
  fetch_news(query_type) → list[NewsItem]
"""
from __future__ import annotations

import json
import os
import re

from models import NewsItem


# ────────────────────────────────────────────────
# 쿼리 프리셋
# ────────────────────────────────────────────────

_QUERY_GLOBAL = """
오늘 날짜 기준으로 한국 주식 시장(KOSPI·KOSDAQ)에 영향을 줄 수 있는
글로벌 주요 뉴스와 경제 이슈를 5~7개 수집해 주세요.

아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "impact": "높음 또는 중간 또는 낮음",
    "title": "뉴스 제목 (한국어, 50자 이내)",
    "summary": "핵심 내용 (한국어, 80자 이내)",
    "sectors": ["관련 한국 섹터1", "관련 한국 섹터2"]
  }
]

영향도 기준:
- 높음: 연준 결정, 미중 무역 분쟁, 반도체·배터리 직접 영향, 환율 급변
- 중간: 주요국 경제지표, 원자재 급등락, 주요 기업 실적
- 낮음: 정치 이슈, 간접 영향 뉴스

섹터 예시: 반도체, 배터리, 바이오, 금융, 소비재, 화학, 에너지, IT, 자동차, 방산
"""

_QUERY_DOMESTIC = """
오늘 날짜 기준으로 한국 주식 시장에 직접 영향을 줄 국내 주요 뉴스를
3~5개 수집해 주세요.

아래 JSON 배열 형식으로만 응답하세요 (다른 텍스트 없이):
[
  {
    "impact": "높음 또는 중간 또는 낮음",
    "title": "뉴스 제목 (한국어, 50자 이내)",
    "summary": "핵심 내용 (한국어, 80자 이내)",
    "sectors": ["관련 섹터1", "관련 섹터2"]
  }
]
"""

_QUERY_EVENING = """
한국 시각 오후 9시 기준, 미국 증시 개장 전후 글로벌 이슈와
내일(익일) 예정된 주요 경제 이벤트·일정을 수집해 주세요.

아래 JSON 두 키로만 응답하세요:
{
  "news": [
    {
      "impact": "높음 또는 중간 또는 낮음",
      "title": "이슈 제목 (50자 이내)",
      "summary": "요약 (80자 이내)",
      "sectors": ["관련 섹터"]
    }
  ],
  "tomorrow_events": [
    "익일 주요 이벤트 1줄 설명",
    "익일 주요 이벤트 1줄 설명"
  ]
}
"""


# ────────────────────────────────────────────────
# Gemini API 호출
# ────────────────────────────────────────────────

def _call_gemini(prompt: str) -> str:
    """Gemini API 호출 → 텍스트 응답 반환"""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise EnvironmentError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    import google.generativeai as genai
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content(prompt)
    return response.text


def _parse_news_json(raw: str) -> list[dict]:
    """응답에서 JSON 배열 추출 (코드블록 제거 포함)"""
    # ```json ... ``` 제거
    raw = re.sub(r"```(?:json)?", "", raw).strip().rstrip("`").strip()
    return json.loads(raw)


def _dicts_to_news_items(items: list[dict]) -> list[NewsItem]:
    return [
        NewsItem(
            impact=d.get("impact", "낮음"),
            title=d.get("title", ""),
            summary=d.get("summary", ""),
            sectors=d.get("sectors", []),
        )
        for d in items
        if d.get("title")
    ]


# ────────────────────────────────────────────────
# 공개 인터페이스
# ────────────────────────────────────────────────

def fetch_news(query_type: str = "global") -> list[NewsItem]:
    """
    query_type: "global" | "domestic" | "evening"
    반환: NewsItem 리스트
    """
    query_map = {
        "global":   _QUERY_GLOBAL,
        "domestic": _QUERY_DOMESTIC,
        "evening":  _QUERY_EVENING,
    }
    prompt = query_map.get(query_type, _QUERY_GLOBAL)

    print(f"[news_monitor] Gemini API 호출 중 (type={query_type})")
    try:
        raw = _call_gemini(prompt)

        if query_type == "evening":
            data = _parse_news_json(raw)
            if isinstance(data, dict):
                return _dicts_to_news_items(data.get("news", []))
            return _dicts_to_news_items(data if isinstance(data, list) else [])

        items = _parse_news_json(raw)
        news = _dicts_to_news_items(items if isinstance(items, list) else [])
        print(f"[news_monitor] 수집 완료 — {len(news)}건")
        return news

    except Exception as e:
        print(f"[news_monitor] 뉴스 수집 실패: {e}")
        return []


def fetch_tomorrow_events(raw_evening_response: str | None = None) -> list[str]:
    """
    이브닝 브리핑용 익일 이벤트 리스트 반환.
    raw_evening_response 가 없으면 Gemini를 다시 호출합니다.
    """
    try:
        if raw_evening_response is None:
            raw_evening_response = _call_gemini(_QUERY_EVENING)
        raw = re.sub(r"```(?:json)?", "", raw_evening_response).strip().rstrip("`").strip()
        data = json.loads(raw)
        if isinstance(data, dict):
            return data.get("tomorrow_events", [])
    except Exception as e:
        print(f"[news_monitor] 익일 이벤트 파싱 실패: {e}")
    return []
