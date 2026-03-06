"""
supabase.py — 백엔드 Supabase 클라이언트 싱글톤

watchlist 테이블 조회 등 DB 접근에 사용합니다.
SERVICE_KEY를 사용해 RLS를 우회합니다.
"""
from __future__ import annotations

import os
from datetime import date as date_type
from functools import lru_cache
from typing import Optional

from supabase import create_client, Client


@lru_cache(maxsize=1)
def get_supabase() -> Optional[Client]:
    """Supabase 클라이언트 반환 (환경변수 미설정 시 None)"""
    url = os.getenv("SUPABASE_URL", "")
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        print("[supabase] SUPABASE_URL 또는 SUPABASE_SERVICE_KEY 미설정 — DB 기능 비활성화")
        return None
    return create_client(url, key)


def fetch_watchlist_tickers() -> list[str]:
    """
    watchlist 테이블에서 사용자 관심 종목 코드 목록 반환.
    Supabase 미설정 또는 테이블 없을 경우 빈 리스트 반환.
    """
    client = get_supabase()
    if client is None:
        return []
    try:
        res = client.table("watchlist").select("ticker").execute()
        return [row["ticker"] for row in (res.data or [])]
    except Exception as e:
        print(f"[supabase] watchlist 조회 실패: {e}")
        return []


def fetch_watchlist() -> list[dict]:
    """
    watchlist 테이블 전체 행 반환 (ticker, name, market, alias 포함).
    """
    client = get_supabase()
    if client is None:
        return []
    try:
        res = client.table("watchlist").select("ticker, name, market, alias").execute()
        return res.data or []
    except Exception as e:
        print(f"[supabase] watchlist 전체 조회 실패: {e}")
        return []


# ────────────────────────────────────────────────
# WRITE 함수
# ────────────────────────────────────────────────

def save_market_report(
    report_date: date_type,
    report_type: str,
    market_score: int | None,
    content: dict,
) -> bool:
    """
    market_reports 테이블에 브리핑 데이터 저장 (upsert).
    같은 날짜·유형이 이미 존재하면 덮어씁니다.

    report_type : 'morning' | 'open' | 'close' | 'evening'
    content     : JSONB — 시장 지표·뉴스·전략 등 전체 컨텍스트 딕셔너리
    """
    client = get_supabase()
    if client is None:
        return False
    try:
        client.table("market_reports").upsert(
            {
                "report_date":  report_date.isoformat(),
                "report_type":  report_type,
                "market_score": market_score,
                "content":      content,
            },
            on_conflict="report_date,report_type",
        ).execute()
        print(f"[supabase] market_reports 저장 완료: {report_type} {report_date}")
        return True
    except Exception as e:
        print(f"[supabase] market_reports 저장 실패: {e}")
        return False


def save_daily_strategy(strategy: dict) -> bool:
    """
    strategies 테이블에 일별 전략 저장.
    기존 스키마: strategy_date, market_phase, market_score,
                overall_stance, strategy_data (JSONB), summary
    """
    client = get_supabase()
    if client is None:
        return False
    try:
        client.table("strategies").insert(
            {
                "strategy_date":  strategy.get("strategy_date"),
                "market_phase":   strategy.get("market_phase"),
                "market_score":   strategy.get("market_score"),
                "overall_stance": strategy.get("overall_stance"),
                "strategy_data":  strategy,
                "summary":        strategy.get("summary", ""),
            }
        ).execute()
        print(f"[supabase] strategies 저장 완료: {strategy.get('strategy_date')}")
        return True
    except Exception as e:
        print(f"[supabase] strategies 저장 실패: {e}")
        return False


def save_stock_snapshots(snapshots: list[dict]) -> bool:
    """
    stock_snapshots 테이블에 종목 OHLCV 캐시 저장 (bulk upsert).
    각 dict 필수 키: ticker, trade_date
    선택 키: open, high, low, close, volume, change_pct, per, pbr
    """
    client = get_supabase()
    if client is None or not snapshots:
        return False
    try:
        client.table("stock_snapshots").upsert(
            snapshots,
            on_conflict="ticker,trade_date",
        ).execute()
        print(f"[supabase] stock_snapshots 저장 완료: {len(snapshots)}종목")
        return True
    except Exception as e:
        print(f"[supabase] stock_snapshots 저장 실패: {e}")
        return False
