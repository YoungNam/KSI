
# KSI — Korean Stock Intelligence
# KOSPI · KOSDAQ 개인화 주식투자 컨설팅 웹서비스

## 프로젝트 개요
- 서비스명: KSI (Korean Stock Intelligence)
- 목적: KOSPI·KOSDAQ 대상 AI 기반 개인화 투자 컨설팅
- 운영자: Justin0
- 규모: 소규모 개인·내부팀 (1~10명)
- 상태: 개발중

## 기술 스택
- Frontend : Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts
- Backend  : FastAPI (Python 3.12+) + APScheduler
- Database : Supabase (PostgreSQL) + Realtime
- Data     : pykrx, FinanceDataReader, KRX Data API
- AI       : Claude API (분석·전략), Gemini MCP (글로벌 리서치·뉴스)
- Deploy   : Vercel (FE) + Railway (BE) + Cloudflare (DNS)

## 디렉토리 구조
```
ksi/
├── frontend/          # Next.js 앱
│   ├── app/           # App Router 페이지 라우팅
│   ├── components/    # UI 컴포넌트 (차트, 카드, 테이블)
│   └── lib/           # Supabase 클라이언트, 유틸리티
├── backend/           # FastAPI 앱
│   ├── api/           # 라우터·엔드포인트
│   ├── scheduler/     # APScheduler 태스크
│   └── agents/        # 에이전트 정의 파일
│   └── commands/      # 슬래시 커스텀 명령어
└── CLAUDE.md          # 이 파일
```

## 코딩 규칙
- 코드 주석: 한국어로 작성
- 변수명: camelCase (TS), snake_case (Python)
- API 응답: JSON, 한국어 메시지 포함
- 에러 처리: 모든 API에 try/except + 에러 코드
- 환경변수: .env.local (FE), .env (BE) — 절대 Git 커밋 금지
- 커밋 단위: 기능 1개 완성 시마다 git commit 권장

## 에이전트팀 구성
- market-analyst    : KOSPI·KOSDAQ 시장 데이터 수집·분석
- strategy-generator: 투자 전략 생성·업데이트
- stock-picker      : 특징주 스캔·종목 선정·펀더멘털 분석
- news-monitor      : 글로벌·국내 이슈 수집 (Gemini MCP 우선)
- report-writer     : 4회 브리핑 리포트 생성·포맷팅
- frontend-dev      : Next.js UI 구현·차트 컴포넌트
- backend-dev       : FastAPI API·스케줄러 구현
- devops            : Docker·배포 설정·CI/CD

## 스케줄러 함수 목록 (scheduler/tasks.py)
- ntx_morning_briefing()  → 매일 07:00 KST
- market_open_update()    → 평일 09:10 KST
- market_close_report()   → 평일 16:10 KST
- ntx_evening_briefing()  → 매일 21:00 KST

## 환경변수 위치
- Frontend: `frontend/.env.local`
- Backend: `backend/.env`
- 키 목록: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
           ANTHROPIC_API_KEY, GEMINI_API_KEY, KRX_API_KEY
- **실제 키 값은 절대 이 파일에 기재하지 말 것**
