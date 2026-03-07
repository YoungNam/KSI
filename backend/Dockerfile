FROM python:3.11-slim

WORKDIR /app

# 빌드 의존성
RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# setuptools(pkg_resources 포함) 먼저 설치 후 나머지 의존성
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "setuptools>=70.0.0" wheel && \
    pip install --no-cache-dir -r requirements.txt && \
    python -c "import pkg_resources; print('pkg_resources OK')"

COPY . .

EXPOSE 8000

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
