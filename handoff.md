# KSI Handoff — Korean Stock Intelligence
> 마지막 업데이트: 2026-03-07
> 상태: **배포 완료** — Vercel (FE) + Railway (BE) 운영 중 / 코드 레벨 TODO 모두 완료

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
| Data | pykrx, FinanceDataReader |
| AI | Claude API (`claude-sonnet-4-6`), Gemini API (`gemini-2.0-flash`) |
| Deploy | Vercel (FE) + Railway (BE) + Cloudflare (DNS) |

---

## 현재 구현 완료 (2026-03-06 세션)

### 백엔드 에이전트 파이프라인

```
backend/
├── agents/
│   ├── market_analyst.py     ← pykrx + FinanceDataReader → MarketAnalysis
│   ├── news_monitor.py       ← Gemini API → list[NewsItem]
│   ├── stock_picker.py       ← pykrx 특징주 스캔 → list[StockCandidate]
│   ├── strategy_generator.py ← Claude API → strategy_YYYY-MM-DD.json
│   └── report_writer.py      ← 4종 Markdown 브리핑 생성·저장
├── data/
│   └── market_data.py        ← fetch_korean_market() / fetch_global_market()
├── api/v1/
│   └── router.py             ← 6개 엔드포인트 구현 완료
├── scheduler/
│   └── tasks.py              ← 4회 브리핑 자동 파이프라인 연결
└── main.py                   ← FastAPI 앱 + CORS + Lifespan
```

#### 에이전트 파이프라인 흐름

| 시각 | 파이프라인 |
|------|-----------|
| 07:00 | market_analyst → news(global+domestic) → stock_picker → strategy_generator → report_writer(morning) |
| 09:10 | market_analyst(실시간) → stock_picker → news(domestic) → report_writer(open) |
| 16:10 | market_analyst(마감) → stock_picker → news(domestic) → tomorrow_events → report_writer(close) |
| 21:00 | market_analyst → news_monitor(evening, 단일 호출) → strategy_generator → report_writer(evening) |

#### 브리핑 포맷 (4종)
- **morning** (`morning_YYYY-MM-DD.md`): 글로벌 동향 → 이슈 → 한국 전망 → 관심종목 TOP5 → 투자 전략
- **open** (`open_YYYY-MM-DD.md`): 개장 현황 → 외국인·기관 수급 → 특징주 → 단기 매매 포인트
- **close** (`close_YYYY-MM-DD.md`): 마감 현황 → 수급 결산 → 섹터 → 종목 결산 → 내일 포인트
- **evening** (`evening_YYYY-MM-DD.md`): 미국 선물 → 글로벌 이슈(영향도) → 익일 이벤트 → 익일 전략

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

1. **`stock/[ticker]/page.tsx`**: pykrx 실제 OHLCV 데이터 연동 완료 (`GET /api/v1/stocks/{ticker}/price`)
2. **전략 페이지 필드 정렬**: `approach`, `key_stocks`, `POSITION_LABELS` 한국어 매핑 모두 구현됨
3. **`stock_picker.py` fallback**: `_latest_trading_date()` — 장 마감·주말·공휴일 자동 전일 데이터 탐색
4. **보고서 자동 갱신**: `fetchBriefingStatus` 5초 폴링 + `file_mtime` 비교로 완료 감지
5. **Supabase 마이그레이션 SQL**: `001_create_tables.sql` + `002_schema_update.sql` 준비됨
6. **배포**: Vercel (FE) + Railway (BE) 운영 중

### 🔴 운영 환경 설정 필요 (코드 변경 없음)

1. **Supabase 테이블 생성**: Supabase 대시보드 > SQL Editor에서 아래 순서로 실행
   - `backend/migrations/001_create_tables.sql`
   - `backend/migrations/002_schema_update.sql`
   - 이후 watchlist 테이블 Realtime 활성화 확인
2. **Gemini API 키**: `backend/.env`에 `GEMINI_API_KEY` 설정 시 뉴스 수집 활성화
   (미설정 시 빈 리스트 반환, 파이프라인은 중단 없이 진행)

### 🟢 향후 기능 (우선순위 낮음)

3. **관심 종목 알림**: Supabase Edge Functions으로 푸시 알림
4. **인증**: Supabase Auth로 사용자 인증 추가

---

## 에이전트 파일 위치 (Claude Code 에이전트 정의)

```
.claude/agents/
├── market-analyst.md       ← pykrx 시장 분석
├── news-monitor.md         ← Gemini MCP 뉴스 수집
├── stock-picker.md         ← 특징주 스캔
├── strategy-generator.md   ← 투자 전략 생성
├── report-writer.md        ← 브리핑 리포트 생성 (포맷 명세 포함)
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

### 브리핑 파일 저장 경로
- `backend/reports/{type}_{YYYY-MM-DD}.md` (Markdown)
- `backend/reports/strategy_{YYYY-MM-DD}.json` (전략 JSON)

### CORS 설정
- `allow_origin_regex=r"http://localhost:\d+"` — 개발 환경 전체 허용
- `FRONTEND_URL` 환경변수 — 운영 도메인 추가 허용
