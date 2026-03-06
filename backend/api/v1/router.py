"""
API v1 라우터 — KSI 핵심 엔드포인트

GET /market/summary    → 시장 분석 (KOSPI·KOSDAQ + 기술 지표)
GET /stocks/featured   → 특징주 스캔 결과
GET /strategy/today    → 오늘의 투자 전략 JSON
GET /reports/latest    → 최근 브리핑 리포트 (Markdown)
GET /reports/{type}    → 특정 유형 브리핑 리포트
POST /briefing/run     → 수동 브리핑 즉시 실행
"""
import asyncio
import json
from datetime import date, datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()

REPORTS_DIR = Path(__file__).parent.parent.parent / "reports"


# ────────────────────────────────────────────────
# 헬퍼
# ────────────────────────────────────────────────

def _run_sync(fn, *args, **kwargs):
    """동기 함수를 asyncio 스레드 풀에서 실행 (FastAPI 이벤트 루프 블록 방지)"""
    loop = asyncio.get_event_loop()
    return loop.run_in_executor(None, lambda: fn(*args, **kwargs))


def _latest_report_path(report_type: str) -> Optional[Path]:
    """reports/ 에서 {type}_*.md 중 가장 최신 파일 반환"""
    files = sorted(REPORTS_DIR.glob(f"{report_type}_*.md"), reverse=True)
    return files[0] if files else None


def _latest_strategy_path() -> Optional[Path]:
    files = sorted(REPORTS_DIR.glob("strategy_*.json"), reverse=True)
    return files[0] if files else None


# ────────────────────────────────────────────────
# 응답 모델
# ────────────────────────────────────────────────

class MarketSummaryResponse(BaseModel):
    kospi_index:    float
    kospi_change:   float
    kosdaq_index:   float
    kosdaq_change:  float
    kospi_volume:   str
    kosdaq_volume:  str
    foreign_net:    str
    institution_net: str
    market_score:   int
    market_phase:   str
    overall_stance: str
    indicators:     dict
    generated_at:   str


class StockItem(BaseModel):
    name:   str
    ticker: str
    action: str
    reason: str
    target: Optional[float] = None
    stop:   Optional[float] = None


class FeaturedStocksResponse(BaseModel):
    market:  str
    stocks:  list[StockItem]
    count:   int
    generated_at: str


class ReportResponse(BaseModel):
    report_type: str
    report_date: str
    content:     str   # Markdown 원문
    file_path:   str
    file_mtime:  str   # 파일 수정 시각 ISO 문자열 — 폴링 변경 감지용


class BriefingRunRequest(BaseModel):
    briefing_type: str  # "morning" | "open" | "close" | "evening"


# 실행 중인 브리핑 태스크 상태 추적 {type: "running"|"done"|"failed"}
_briefing_status: dict[str, str] = {}


# ────────────────────────────────────────────────
# 엔드포인트
# ────────────────────────────────────────────────

@router.get("/market/summary", response_model=MarketSummaryResponse)
async def get_market_summary():
    """
    KOSPI·KOSDAQ 현황 + 기술 지표 + 시장점수 반환.
    pykrx 실시간 데이터 기반 (수 초 소요).
    """
    try:
        from agents.market_analyst import analyze_market
        analysis = await _run_sync(analyze_market)
        k = analysis.korean_market

        return MarketSummaryResponse(
            kospi_index=k.kospi_index,
            kospi_change=k.kospi_change,
            kosdaq_index=k.kosdaq_index,
            kosdaq_change=k.kosdaq_change,
            kospi_volume=k.kospi_volume,
            kosdaq_volume=k.kosdaq_volume,
            foreign_net=k.foreign_net,
            institution_net=k.institution_net,
            market_score=analysis.market_score,
            market_phase=analysis.market_phase,
            overall_stance=analysis.overall_stance,
            indicators=analysis.indicators,
            generated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"시장 분석 실패: {str(e)}")


@router.get("/stocks/featured", response_model=FeaturedStocksResponse)
async def get_featured_stocks(
    market: str = Query(default="ALL", description="KOSPI | KOSDAQ | ALL"),
    top_n:  int = Query(default=10, ge=1, le=30),
):
    """
    등락률 ±5% 이상 + 거래량 200% 이상 특징주 스캔.
    pykrx 실시간 데이터 기반.
    """
    try:
        from agents.stock_picker import scan_featured_stocks
        stocks = await _run_sync(scan_featured_stocks, market, top_n)

        return FeaturedStocksResponse(
            market=market,
            stocks=[
                StockItem(
                    name=s.name,
                    ticker=s.ticker,
                    action=s.action,
                    reason=s.reason,
                    target=s.target,
                    stop=s.stop,
                )
                for s in stocks
            ],
            count=len(stocks),
            generated_at=datetime.now().isoformat(),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"특징주 스캔 실패: {str(e)}")


@router.get("/strategy/today")
async def get_today_strategy():
    """
    오늘 날짜의 투자 전략 JSON 반환.
    파일이 없으면 404 반환 (스케줄러 또는 /briefing/run 으로 생성).
    """
    path = _latest_strategy_path()
    if path is None:
        raise HTTPException(
            status_code=404,
            detail="전략 파일이 없습니다. 모닝 브리핑 실행 후 다시 시도하세요.",
        )

    try:
        content = json.loads(path.read_text(encoding="utf-8"))
        return {
            "strategy_date": content.get("strategy_date"),
            "file": path.name,
            "data": content,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"전략 파일 읽기 실패: {str(e)}")


@router.get("/reports/latest", response_model=ReportResponse)
async def get_latest_report(
    report_type: str = Query(default="morning", description="morning | open | close | evening"),
):
    """
    가장 최근의 지정 유형 브리핑 Markdown 반환.
    """
    allowed = {"morning", "open", "close", "evening"}
    if report_type not in allowed:
        raise HTTPException(status_code=400, detail=f"report_type은 {allowed} 중 하나여야 합니다.")

    path = _latest_report_path(report_type)
    if path is None:
        raise HTTPException(
            status_code=404,
            detail=f"'{report_type}' 브리핑 파일이 없습니다.",
        )

    content = path.read_text(encoding="utf-8")
    # 파일명에서 날짜 추출: morning_2026-03-07.md → 2026-03-07
    report_date = path.stem.split("_", 1)[-1]
    # 파일 수정 시각 (폴링 변경 감지용)
    file_mtime = datetime.fromtimestamp(path.stat().st_mtime).isoformat()

    return ReportResponse(
        report_type=report_type,
        report_date=report_date,
        content=content,
        file_path=str(path),
        file_mtime=file_mtime,
    )


@router.get("/reports/list")
async def list_reports():
    """저장된 모든 브리핑 파일 목록 반환"""
    files = sorted(REPORTS_DIR.glob("*.md"), reverse=True)
    return {
        "reports": [
            {
                "filename": f.name,
                "type": f.stem.split("_")[0],
                "date": f.stem.split("_", 1)[-1],
                "size_kb": round(f.stat().st_size / 1024, 1),
            }
            for f in files
        ],
        "total": len(files),
    }


@router.get("/stocks/{ticker}/price")
async def get_stock_price(
    ticker: str,
    days: int = Query(default=30, ge=5, le=365, description="조회 거래일 수"),
):
    """
    개별 종목 OHLCV 히스토리 반환 (pykrx).
    장 마감·주말에는 최근 거래일 데이터를 반환합니다.
    """
    try:
        from pykrx import stock
        from datetime import datetime, timedelta

        # 거래일 여유를 두어 충분한 기간 조회
        end = datetime.today()
        start = end - timedelta(days=days + 30)

        start_str = start.strftime("%Y%m%d")
        end_str = end.strftime("%Y%m%d")

        df = stock.get_market_ohlcv(start_str, end_str, ticker)

        if df.empty:
            raise HTTPException(status_code=404, detail=f"종목 {ticker} 데이터를 찾을 수 없습니다.")

        # 최근 days 거래일만 반환
        df = df.tail(days)

        # 종목명 조회
        try:
            name = stock.get_market_ticker_name(ticker)
        except Exception:
            name = ticker

        # 컬럼명 정규화 (pykrx 버전별 차이 대응)
        col_map = {
            "시가": ["시가", "Open"],
            "고가": ["고가", "High"],
            "저가": ["저가", "Low"],
            "종가": ["종가", "Close"],
            "거래량": ["거래량", "Volume"],
        }
        def _get_col(name_list):
            for c in name_list:
                if c in df.columns:
                    return c
            return None

        open_col   = _get_col(col_map["시가"])
        high_col   = _get_col(col_map["고가"])
        low_col    = _get_col(col_map["저가"])
        close_col  = _get_col(col_map["종가"])
        volume_col = _get_col(col_map["거래량"])

        if close_col is None:
            raise HTTPException(status_code=500, detail="종가 컬럼을 찾을 수 없습니다.")

        price_history = [
            {
                "date": idx.strftime("%Y-%m-%d"),
                "open":   int(row[open_col])   if open_col   else 0,
                "high":   int(row[high_col])   if high_col   else 0,
                "low":    int(row[low_col])    if low_col    else 0,
                "close":  int(row[close_col]),
                "volume": int(row[volume_col]) if volume_col else 0,
            }
            for idx, row in df.iterrows()
        ]

        # 전일 대비 등락 계산
        current = price_history[-1] if price_history else None
        prev    = price_history[-2] if len(price_history) >= 2 else None
        change      = 0.0
        change_rate = 0.0
        if current and prev and prev["close"] > 0:
            change      = current["close"] - prev["close"]
            change_rate = (change / prev["close"]) * 100

        return {
            "ticker":          ticker,
            "name":            name,
            "current_price":   current["close"] if current else 0,
            "change":          round(change),
            "change_rate":     round(change_rate, 2),
            "current_volume":  current["volume"] if current else 0,
            "price_history":   price_history,
            "generated_at":    datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"주가 조회 실패: {str(e)}")


@router.get("/briefing/status/{briefing_type}")
async def get_briefing_status(briefing_type: str):
    """브리핑 태스크 실행 상태 조회 (running | done | failed | idle)"""
    status = _briefing_status.get(briefing_type, "idle")
    return {"briefing_type": briefing_type, "status": status}


@router.post("/briefing/run")
async def run_briefing_now(
    req: BriefingRunRequest,
    background_tasks: BackgroundTasks,
):
    """
    수동으로 브리핑을 즉시 실행 (백그라운드 태스크).
    실행 상태는 GET /briefing/status/{type} 으로 폴링.
    """
    type_map = {
        "morning": "ntx_morning_briefing",
        "open":    "market_open_update",
        "close":   "market_close_report",
        "evening": "ntx_evening_briefing",
    }
    fn_name = type_map.get(req.briefing_type)
    if fn_name is None:
        raise HTTPException(
            status_code=400,
            detail=f"briefing_type은 {list(type_map.keys())} 중 하나여야 합니다.",
        )

    from scheduler import tasks as task_module
    fn = getattr(task_module, fn_name)
    btype = req.briefing_type

    # 실행 상태를 추적하는 래퍼
    def _run_with_status():
        _briefing_status[btype] = "running"
        try:
            fn()
            _briefing_status[btype] = "done"
        except Exception as e:
            _briefing_status[btype] = f"failed: {str(e)[:120]}"
            print(f"[briefing/run] {btype} 실패: {e}")

    background_tasks.add_task(_run_with_status)

    return {
        "message": f"'{req.briefing_type}' 브리핑 실행이 백그라운드에서 시작됐습니다.",
        "briefing_type": req.briefing_type,
        "started_at": datetime.now().isoformat(),
    }
