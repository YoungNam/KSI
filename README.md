# KSI — Korean Stock Intelligence

KOSPI · KOSDAQ 대상 AI 기반 개인화 투자 컨설팅 웹서비스입니다.
매일 4회 자동 브리핑(07:00 / 09:10 / 16:10 / 21:00 KST)을 생성하고,
Claude API 기반 에이전트팀이 시장 분석 · 전략 생성 · 종목 스캔 · 리포트 작성을 자동화합니다.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS + Recharts |
| Backend | FastAPI (Python 3.12+) + APScheduler |
| Database | Supabase (PostgreSQL + Realtime) |
| 주식 데이터 | pykrx, FinanceDataReader, KRX Data API |
| AI | Claude API (분석 · 전략), Gemini API (글로벌 리서치 · 뉴스) |
| Deploy | Vercel (Frontend) + Railway (Backend) + Cloudflare (DNS) |

---

## 디렉토리 구조

```
ksi/
├── backend/                # FastAPI 앱 — Railway 배포
│   ├── main.py             # FastAPI 진입점
│   ├── requirements.txt    # Python 의존성
│   ├── Procfile            # Railway 실행 명령
│   ├── railway.toml        # Railway 빌드 설정
│   ├── .env.example        # 환경변수 예시
│   ├── api/                # 라우터 · 엔드포인트
│   ├── agents/             # AI 에이전트 정의
│   ├── scheduler/          # APScheduler 태스크
│   ├── db/                 # Supabase 클라이언트
│   └── data/               # 주식 데이터 수집
├── frontend/               # Next.js 앱 — Vercel 배포
│   ├── app/                # App Router 페이지
│   ├── components/         # UI 컴포넌트 (차트, 카드, 테이블)
│   ├── lib/                # Supabase 클라이언트, 유틸리티
│   ├── hooks/              # 커스텀 React Hooks
│   └── vercel.json         # Vercel 빌드 설정
└── CLAUDE.md               # 에이전트 지시사항
```

---

## 로컬 개발 실행 방법

### 사전 요구사항

- Python 3.12+
- Node.js 20+
- Git

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/ksi.git
cd ksi
```

### 2. Backend 실행

```bash
cd backend

# 가상환경 생성 및 활성화
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일을 열어 실제 키 값 입력

# 서버 시작 (http://localhost:8000)
uvicorn main:app --reload --port 8000
```

### 3. Frontend 실행

```bash
cd frontend

# 의존성 설치
npm install

# 환경변수 설정
cp .env.local.example .env.local   # 또는 직접 생성
# NEXT_PUBLIC_API_URL=http://localhost:8000
# NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 개발 서버 시작 (http://localhost:3000)
npm run dev
```

### 4. API 문서 확인

백엔드 실행 후 브라우저에서 접속:

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- 헬스체크: http://localhost:8000/health

---

## 배포 방법

### Backend — Railway

1. [Railway](https://railway.app) 에 로그인 후 New Project 생성
2. GitHub 저장소 연결 후 `backend/` 디렉토리를 루트로 설정
3. Variables 탭에서 아래 환경변수 추가 (Railway가 `PORT`는 자동 주입)
4. `backend/railway.toml`이 자동으로 빌드 · 배포 설정을 읽어 적용
5. 배포 완료 후 생성된 URL을 프론트엔드 `NEXT_PUBLIC_API_URL`에 등록

### Frontend — Vercel

1. [Vercel](https://vercel.com) 에 로그인 후 New Project 생성
2. GitHub 저장소 연결, Root Directory를 `frontend/`로 설정
3. Environment Variables 탭에서 아래 환경변수 추가
4. `frontend/vercel.json`이 빌드 설정을 자동 적용
5. 배포 완료 후 생성된 URL을 Railway 백엔드의 `FRONTEND_URL`에 등록

---

## 환경변수 목록

### Backend (`backend/.env`)

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL | O |
| `SUPABASE_ANON_KEY` | Supabase anon (공개) 키 | O |
| `SUPABASE_SERVICE_KEY` | Supabase service role 키 (관리용) | O |
| `ANTHROPIC_API_KEY` | Claude API 키 | O |
| `GEMINI_API_KEY` | Google Gemini API 키 | O |
| `KRX_API_KEY` | KRX Data API 키 | 선택 |
| `FRONTEND_URL` | 프론트엔드 운영 도메인 (CORS 허용) | O |
| `APP_ENV` | 실행 환경 (`development` / `production`) | O |
| `PORT` | 서버 포트 — Railway 자동 주입 | 자동 |

### Frontend (`frontend/.env.local`)

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `NEXT_PUBLIC_API_URL` | 백엔드 API 기본 URL | O |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | O |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (공개) 키 | O |

> 주의: `NEXT_PUBLIC_` 접두사 변수는 브라우저에 노출됩니다.
> Service Role 키는 절대 프론트엔드에 포함하지 마십시오.

---

## 에이전트팀

| 에이전트 | 역할 |
|----------|------|
| `market-analyst` | KOSPI · KOSDAQ 시장 데이터 수집 · 분석 |
| `strategy-generator` | 투자 전략 생성 · 업데이트 |
| `stock-picker` | 특징주 스캔 · 종목 선정 · 펀더멘털 분석 |
| `news-monitor` | 글로벌 · 국내 이슈 수집 (Gemini API) |
| `report-writer` | 4회 브리핑 리포트 생성 · 포맷팅 |

## 자동 브리핑 스케줄 (KST)

| 시각 | 태스크 |
|------|--------|
| 07:00 | 모닝 브리핑 — 전일 마감 정리 + 당일 전략 |
| 09:10 | 장 시작 업데이트 — 개장 직후 시황 |
| 16:10 | 장 마감 리포트 — 당일 결산 + 특징주 |
| 21:00 | 이브닝 브리핑 — 글로벌 시장 + 익일 전망 |

---

## 헬스체크

```
GET /health
```

```json
{
  "status": "ok",
  "message": "KSI 서버가 정상 동작 중입니다."
}
```

Railway 배포 시 `/health` 엔드포인트를 자동으로 폴링하여 서버 상태를 확인합니다.
(`backend/railway.toml`의 `[deploy.healthcheck]` 참고)
