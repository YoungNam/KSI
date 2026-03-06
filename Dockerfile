FROM python:3.12-slim

WORKDIR /app

# 빌드 의존성 (pandas, numpy 컴파일용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# setuptools 먼저 설치 후 나머지 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# 백엔드 소스 복사
COPY . .

EXPOSE 8000

# Railway가 $PORT 환경변수를 주입함
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
