"""
APScheduler 태스크 — 4회 정기 브리핑 스케줄

파이프라인 흐름:
  모닝    : market_analyst → news_monitor → stock_picker → strategy_generator → Supabase 저장
  장초반  : market_analyst → stock_picker → news_monitor → Supabase 저장
  장마감  : market_analyst → stock_picker → news_monitor → fetch_tomorrow_events → Supabase 저장
  이브닝  : market_analyst → Gemini(evening) → strategy_generator → Supabase 저장
"""
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from agents.market_analyst import analyze_market
from agents.news_monitor import fetch_news, fetch_tomorrow_events
from agents.stock_picker import scan_featured_stocks, scan_by_tickers
from agents.strategy_generator import run_strategy
from db.supabase import (
    fetch_watchlist_tickers,
    save_market_report,
    save_daily_strategy,
)
from models import StockCandidate

scheduler = BackgroundScheduler(timezone="Asia/Seoul")


def _build_report_content(
    korean_market,
    global_market,
    news_items,
    stocks,
    strategy_json=None,
    market_outlook="",
    key_message="",
) -> dict:
    """Supabase JSONB 저장용 딕셔너리 구성"""
    k = korean_market
    g = global_market
    return {
        "korean_market": {
            "kospi_index":    k.kospi_index,
            "kospi_change":   k.kospi_change,
            "kosdaq_index":   k.kosdaq_index,
            "kosdaq_change":  k.kosdaq_change,
            "kospi_volume":   k.kospi_volume,
            "kosdaq_volume":  k.kosdaq_volume,
            "foreign_net":    k.foreign_net,
            "institution_net": k.institution_net,
        },
        "global_market": {
            "sp500_price":   g.sp500_price,
            "sp500_change":  g.sp500_change,
            "nasdaq_price":  g.nasdaq_price,
            "nasdaq_change": g.nasdaq_change,
            "usd_krw":       g.usd_krw,
            "wti_price":     g.wti_price,
            "gold_price":    g.gold_price,
            "us10y_yield":   g.us10y_yield,
        },
        "news_items": [
            {"impact": n.impact, "title": n.title, "summary": n.summary, "sectors": n.sectors}
            for n in news_items
        ],
        "stocks": [
            {"ticker": s.ticker, "name": s.name, "action": s.action, "reason": s.reason}
            for s in stocks
        ],
        "strategy_json":  strategy_json or {},
        "market_outlook": market_outlook,
        "key_message":    key_message,
    }


def _merge_watchlist_stocks(
    watchlist_tickers: list[str],
    featured: list[StockCandidate],
    top_n: int = 7,
) -> list[StockCandidate]:
    """
    관심 종목(watchlist)과 특징주를 합칩니다.
    - 관심 종목을 앞에 배치하고, 중복 제거 후 top_n까지 반환
    """
    watchlist_stocks = scan_by_tickers(watchlist_tickers) if watchlist_tickers else []

    # 관심 종목에 태그 추가
    for s in watchlist_stocks:
        s.reason = f"[관심종목] {s.reason}"

    # 티커 기준 중복 제거 (관심종목 우선)
    seen: set[str] = set()
    merged: list[StockCandidate] = []
    for s in watchlist_stocks + featured:
        if s.ticker not in seen:
            seen.add(s.ticker)
            merged.append(s)

    return merged[:top_n]


def ntx_morning_briefing():
    """07:00 KST — 모닝 브리핑 (장 시작 전 전략)"""
    print("[스케줄러] ─── 모닝 브리핑 시작 ───")
    try:
        # 1. 시장 분석
        analysis = analyze_market()

        # 2. 뉴스 수집 (글로벌 + 국내)
        news = fetch_news("global") + fetch_news("domestic")

        # 3. 특징주 스캔 + 관심 종목 병합
        featured = scan_featured_stocks("ALL", top_n=5)
        watchlist_tickers = fetch_watchlist_tickers()
        stocks = _merge_watchlist_stocks(watchlist_tickers, featured)
        print(f"[스케줄러] 관심종목 {len(watchlist_tickers)}개 + 특징주 {len(featured)}개 → 총 {len(stocks)}개")

        # 4. 투자 전략 생성
        strategy = run_strategy(analysis, news, stocks)

        # 5. Supabase 저장 (전략 + 리포트)
        save_daily_strategy(strategy)
        content = _build_report_content(
            analysis.korean_market, analysis.global_market,
            news, stocks, strategy,
            market_outlook=strategy.get("summary", ""),
            key_message=strategy.get("risk_management", {}).get("notes", ""),
        )
        save_market_report(date.today(), "morning", analysis.market_score, content)
        print("[스케줄러] 모닝 브리핑 완료")

    except Exception as e:
        print(f"[스케줄러] 모닝 브리핑 실패: {e}")


def market_open_update():
    """09:10 KST — 장 초반 업데이트 (개장 후 10분, 평일만)"""
    print("[스케줄러] ─── 장 초반 업데이트 시작 ───")
    try:
        # 1. 실시간 시장 분석
        analysis = analyze_market()

        # 2. 장 초반 특징주 스캔 (KOSPI + KOSDAQ)
        stocks = scan_featured_stocks("ALL", top_n=5)

        # 3. 장중 속보 이슈
        news = fetch_news("domestic")

        # 4. Supabase 저장
        market_outlook = (
            f"KOSPI {analysis.korean_market.kospi_change:+.2f}% / "
            f"KOSDAQ {analysis.korean_market.kosdaq_change:+.2f}% — "
            f"시장 {analysis.market_phase}"
        )
        key_message = "장 초반 15분봉 추세 확립 후 진입 권장" if analysis.market_phase == "횡보" else ""
        content = _build_report_content(
            analysis.korean_market, analysis.global_market,
            news, stocks,
            market_outlook=market_outlook,
            key_message=key_message,
        )
        save_market_report(date.today(), "open", analysis.market_score, content)
        print("[스케줄러] 장 초반 업데이트 완료")

    except Exception as e:
        print(f"[스케줄러] 장 초반 업데이트 실패: {e}")


def market_close_report():
    """16:10 KST — 장 마감 리포트 (폐장 후 10분, 평일만)"""
    print("[스케줄러] ─── 장 마감 리포트 시작 ───")
    try:
        # 1. 마감 시장 분석
        analysis = analyze_market()

        # 2. 당일 관심 종목 결산 (장중 특징주)
        stocks = scan_featured_stocks("ALL", top_n=5)

        # 3. 당일 주요 이슈
        news = fetch_news("domestic")

        # 4. 내일 주요 일정
        tomorrow = fetch_tomorrow_events()

        # 5. Supabase 저장
        strategy_json = {
            "market_phase": analysis.market_phase,
            "overall_stance": analysis.overall_stance,
            "summary": (
                f"KOSPI {analysis.korean_market.kospi_change:+.2f}% 마감. "
                f"시장점수 {analysis.market_score}. 외국인 {analysis.korean_market.foreign_net}."
            ),
        }
        content = _build_report_content(
            analysis.korean_market, analysis.global_market,
            news, stocks, strategy_json,
        )
        content["tomorrow_events"] = tomorrow
        save_market_report(date.today(), "close", analysis.market_score, content)
        print("[스케줄러] 장 마감 리포트 완료")

    except Exception as e:
        print(f"[스케줄러] 장 마감 리포트 실패: {e}")


def ntx_evening_briefing():
    """21:00 KST — 이브닝 브리핑 (미국 장 시작 전)"""
    print("[스케줄러] ─── 이브닝 브리핑 시작 ───")
    try:
        # 1. 글로벌 시장 분석 (미국 선물 포함)
        analysis = analyze_market()

        # 2. 글로벌 이슈 + 익일 이벤트 수집 (evening 모드)
        import json, re
        from agents.news_monitor import _QUERY_EVENING, _call_gemini, _dicts_to_news_items
        raw_evening = _call_gemini(_QUERY_EVENING)

        # 뉴스 파싱
        clean = re.sub(r"```(?:json)?", "", raw_evening).strip().rstrip("`").strip()
        data = json.loads(clean) if clean else {}
        if isinstance(data, dict):
            news = _dicts_to_news_items(data.get("news", []))
            tomorrow = data.get("tomorrow_events", [])
        else:
            news = _dicts_to_news_items(data if isinstance(data, list) else [])
            tomorrow = []

        # 3. 익일 예비 전략 생성
        strategy = run_strategy(analysis, news, [])

        # 4. Supabase 저장 (전략 + 리포트)
        save_daily_strategy(strategy)
        content = _build_report_content(
            analysis.korean_market, analysis.global_market,
            news, [], strategy,
            market_outlook=strategy.get("summary", ""),
            key_message=strategy.get("risk_management", {}).get("notes", ""),
        )
        content["tomorrow_events"] = tomorrow
        save_market_report(date.today(), "evening", analysis.market_score, content)
        print("[스케줄러] 이브닝 브리핑 완료")

    except Exception as e:
        print(f"[스케줄러] 이브닝 브리핑 실패: {e}")


def start_scheduler():
    """스케줄러 시작 및 태스크 등록"""
    scheduler.add_job(ntx_morning_briefing,  CronTrigger(hour=7,  minute=0),  id="morning")
    scheduler.add_job(market_open_update,    CronTrigger(hour=9,  minute=10, day_of_week="mon-fri"), id="open")
    scheduler.add_job(market_close_report,   CronTrigger(hour=16, minute=10, day_of_week="mon-fri"), id="close")
    scheduler.add_job(ntx_evening_briefing,  CronTrigger(hour=21, minute=0),  id="evening")
    scheduler.start()
    print("[스케줄러] APScheduler 시작 완료 — 4개 태스크 등록")


def stop_scheduler():
    """스케줄러 종료"""
    scheduler.shutdown()
    print("[스케줄러] APScheduler 종료")
