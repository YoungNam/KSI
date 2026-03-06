"""
KSI Backend — FastAPI 진입점
"""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.v1.router import router as v1_router
from scheduler.tasks import start_scheduler, stop_scheduler

# 환경변수 로드
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """서버 시작·종료 시 실행되는 라이프사이클 훅"""
    # 시작: 스케줄러 가동
    start_scheduler()
    yield
    # 종료: 스케줄러 중단
    stop_scheduler()


app = FastAPI(
    title="KSI API",
    description="Korean Stock Intelligence — KOSPI·KOSDAQ 개인화 투자 컨설팅 API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS 설정 (프론트엔드 허용)
# FRONTEND_URL: 쉼표 구분으로 여러 도메인 지원 (예: "https://ksi.vercel.app,https://ksi.example.com")
_frontend_urls = [
    u.strip() for u in os.getenv("FRONTEND_URL", "").split(",") if u.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_frontend_urls,
    allow_origin_regex=(
        r"http://localhost:\d+"           # 개발: 모든 localhost 포트 허용
        r"|https://.*\.vercel\.app"       # Vercel 배포 도메인 허용
        r"|https://.*\.railway\.app"      # Railway 도메인 허용 (선택)
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(v1_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """헬스체크 엔드포인트"""
    return {"status": "ok", "message": "KSI 서버가 정상 동작 중입니다."}
