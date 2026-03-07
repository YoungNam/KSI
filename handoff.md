# KSI Handoff — Korean Stock Intelligence
> 마지막 업데이트: 2026-03-07 (3차)
> 상태: **운영 중** — Vercel (FE) + Railway (BE) 배포 완료 / 에이전트 구조 최적화 완료

---

## 프로젝트 개요

- **서비스명**: KSI (Korean Stock Intelligence)
- **목적**: KOSPI·KOSDAQ 대상 AI 기반 개인화 투자 컨설팅
- **운영자**: Justin0
- **작업 디렉토리**: `/Users/justin0/ai_Projects/KSI/`

---

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Recharts |
| Backend | FastAPI (Python 3.12+) + APScheduler |
| Database | Supabase (PostgreSQL + Realtime) |
| Data | FinanceDataReader (주력), pykrx (fallback) |
| AI | Claude API (`claude-sonnet-4-6`), Gemini API (`gemini-2.0-flash`) |
| Deploy | Vercel (FE) + Railway (BE) + Cloudflare (DNS) |

---

## 현재 구현 완료 (2026-03-06 세션)

### 백엔드 에이전트 파이프라인

```
backend/
├── models.py                   ← 공유 dataclass 5개 (GlobalMarket, KoreanMarket, NewsItem, StockCandidate, MarketAnalysis)
├── agents/
│   ├── market_analyst.py       ← FDR + 기술지표 → MarketAnalysis
│   ├── news_monitor.py         ← Gemini API → list[NewsItem]
│   ├── stock_picker.py         ← FDR 특징주 스캔 → list[StockCandidate]
│   └── strategy_generator.py   ← Claude API → strategy_YYYY-MM-DD.json
├── data/
│   └── market_data.py          ← fetch_korean_market() / fetch_global_market()
├── api/v1/
│   └── router.py               ← API 엔드포인트
├── scheduler/
│   └── tasks.py                ← 4회 스케줄 → Supabase 직접 저장 (md 생성 없음)
└── main.py                     ← FastAPI 앱 + CORS + Lifespan
```

#### 에이전트 파이프라인 흐름

| 시각 | 파이프라인 |
|------|-----------|
| 07:00 | market_analyst → news(global+domestic) → stock_picker → strategy_generator → Supabase 저장 |
| 09:10 | market_analyst(실시간) → stock_picker → news(domestic) → Supabase 저장 |
| 16:10 | market_analyst(마감) → stock_picker → news(domestic) → tomorrow_events → Supabase 저장 |
| 21:00 | market_analyst → Gemini(evening) → strategy_generator → Supabase 저장 |

#### 리포트 저장 방식
- .md 파일 생성 **제거됨** (report_writer.py 삭제)
- Supabase `market_reports` 테이블에 JSON으로 직접 저장
- `_build_report_content()` 함수가 JSONB 딕셔너리 구성

### API 엔드포인트 (모두 구현 완료)

```
GET  /health                               헬스체크
GET  /api/v1/market/summary                시장 분석 (KOSPI/KOSDAQ + 기술 지표 + 시장점수)
GET  /api/v1/stocks/featured?market=ALL    특징주 스캔 (±5% / 거래량×2)
GET  /api/v1/strategy/today                오늘 전략 JSON
GET  /api/v1/reports/latest?report_type=   최신 브리핑 Markdown
GET  /api/v1/reports/list                  전체 브리핑 파일 목록
POST /api/v1/briefing/run                  브리핑 수동 즉시 실행
```

### 프론트엔드 (Next.js 15)

```
frontend/
├── app/
│   ├── layout.tsx            ← 사이드바 + 루트 레이아웃
│   ├── page.tsx              ← /dashboard 리다이렉트
│   ├── dashboard/page.tsx    ← 시장 현황 대시보드 (Toss 스타일)
│   ├── reports/page.tsx      ← 4탭 브리핑 + Markdown 렌더링 + 즉시 실행
│   ├── strategy/page.tsx     ← 포지션 PieChart + 단기/중기 전략
│   ├── stock/page.tsx        ← 특징주 스캔 테이블
│   ├── stock/[ticker]/page.tsx ← 종목 상세 + LineChart (목업)
│   └── watchlist/page.tsx    ← Supabase Realtime CRUD
├── components/
│   ├── layout/sidebar.tsx    ← Toss 스타일 네비게이션
│   └── ui/                   ← Card, Badge, Button, Tabs, Table
├── hooks/
│   └── useMarketRealtime.ts  ← Supabase Realtime + 5분 폴링 폴백
└── lib/
    ├── api.ts                ← 6개 API 함수 + TypeScript 타입
    ├── utils.ts              ← cn, formatNumber, getChangeColor 등
    └── supabase.ts           ← Supabase 클라이언트 싱글톤
```

### Toss 디자인 시스템 적용

| 항목 | 값 |
|------|----|
| 배경 | `#0E1117` |
| 카드 | `#161B27`, `border: #242D3D`, `rounded-2xl` |
| Primary | `#3182F6` (Toss Blue) |
| 상승/매수 | `#05C075` (Toss Green) |
| 하락/매도 | `#F04452` (Toss Red) |
| 중립/관망 | `#F5A623` (Amber) |
| 텍스트 1차 | `#F0F4FF` |
| 텍스트 2차 | `#8B96A9` |
| 폰트 | Pretendard Variable |
| 숫자 스타일 | `tabular-nums`, `text-4xl font-bold` |

---

## 실행 방법

```bash
# 백엔드
cd /Users/justin0/ai_Projects/KSI/backend
python3 -m uvicorn main:app --reload --port 8000

# 프론트엔드 (별도 터미널)
cd /Users/justin0/ai_Projects/KSI/frontend
npm run dev   # localhost:3000
```

### 환경변수

| 파일 | 키 |
|------|-----|
| `backend/.env` | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:8000`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

---

## 알려진 이슈 / TODO

### ✅ 완료된 항목 (2026-03-07)

1. **`stock/[ticker]/page.tsx`**: pykrx 실제 OHLCV 데이터 연동 완료
2. **전략 페이지 필드 정렬**: `approach`, `key_stocks`, `POSITION_LABELS` 한국어 매핑
3. **`stock_picker.py` fallback**: `_latest_trading_date()` — 주말·공휴일 자동 전일 탐색
4. **보고서 자동 갱신**: `fetchBriefingStatus` 5초 폴링 + `file_mtime` 비교
5. **Supabase 마이그레이션 SQL**: `001_create_tables.sql` + `002_schema_update.sql` 준비
6. **배포 완료**: Vercel (FE) + Railway (BE) 운영 중
7. **관심종목 섹션**: 대시보드·브리핑·전략 페이지에 `WatchlistSection` 공통 컴포넌트 추가
8. **CORS**: `.vercel.app`, `.railway.app` 도메인 regex 허용
9. **Railway Dockerfile 빌더 전환**: nixpacks → Dockerfile, `sh -c`로 PORT 확장 해결

### ✅ 해결됨 (2026-03-07)

1. **pykrx `pkg_resources` 런타임 오류** → FinanceDataReader(Yahoo Finance)로 대체
2. **에이전트 구조 최적화** → `models.py` 분리, `report_writer.py` 삭제, 스케줄러 단순화
   - 브리핑 페이지(FE) + 브리핑 API(BE) + report_writer 모두 제거
   - .md 파일 생성 없음, Supabase JSON 저장만 유지

### 🔴 운영 환경 설정 필요 (코드 변경 없음)

3. **Supabase 테이블 생성**: Supabase 대시보드 > SQL Editor에서 순서대로 실행
   - `backend/migrations/001_create_tables.sql`
   - `backend/migrations/002_schema_update.sql`
4. **Gemini API 키**: Railway Variables에 `GEMINI_API_KEY` 설정 시 뉴스 수집 활성화

### 🟢 향후 기능 (우선순위 낮음)

5. **관심 종목 알림**: Supabase Edge Functions으로 푸시 알림
6. **인증**: Supabase Auth로 사용자 인증 추가

---

## 에이전트 파일 위치 (Claude Code 에이전트 정의)

```
.claude/agents/
├── market-analyst.md       ← pykrx 시장 분석
├── news-monitor.md         ← Gemini MCP 뉴스 수집
├── stock-picker.md         ← 특징주 스캔
├── strategy-generator.md   ← 투자 전략 생성
├── frontend-dev.md         ← Next.js UI 구현
├── backend-dev.md          ← FastAPI 구현
└── devops.md               ← 배포 설정
```

---

## 핵심 설계 원칙 (변경 주의)

### 백엔드 데이터 타입
- `kospi_volume`, `kosdaq_volume`: **string** (`"8.5조"`) — pykrx 거래대금을 포맷팅한 값
- `foreign_net`, `institution_net`: **string** (`"+2,345억"` 또는 `"—"`) — 수급 포맷팅 값
- `market_score`: **int** (0~100) — 기술 지표 기반 종합 점수

### 파일 저장 경로
- `backend/reports/strategy_{YYYY-MM-DD}.json` (전략 JSON)
- 브리핑 .md 파일은 더 이상 생성하지 않음 (Supabase JSONB로 대체)

### CORS 설정
- `allow_origin_regex=r"http://localhost:\d+"` — 개발 환경 전체 허용
- `FRONTEND_URL` 환경변수 — 운영 도메인 추가 허용
