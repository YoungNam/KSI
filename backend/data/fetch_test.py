"""
데이터 수집 테스트 스크립트
- pykrx    : KOSPI 지수, 삼성전자(005930) 주가
- FinanceDataReader : 삼성전자 장기 주가 (백업)

실행: python -m backend.data.fetch_test
     또는 backend/ 디렉토리에서: python data/fetch_test.py

주의: KRX_API_KEY 미발급 상태 — 임시 키로 동작 확인용 스크립트
      pykrx는 KRX 공공 데이터(인증 불필요)를 직접 파싱하므로
      KRX_API_KEY 없이도 기본 OHLCV 데이터 조회 가능
"""
import os
from datetime import datetime, timedelta

from dotenv import load_dotenv

load_dotenv()

# KRX API 키 (미발급 시 임시값 사용)
KRX_API_KEY = os.getenv("KRX_API_KEY", "TEST-KRX-API-KEY-PLACEHOLDER")


# ── 1. pykrx로 KOSPI 지수 조회 ─────────────────────────────────────────────
def fetch_kospi_index():
    """pykrx로 최근 5일 KOSPI 지수를 가져옵니다."""
    try:
        from pykrx import stock

        today = datetime.today().strftime("%Y%m%d")
        five_days_ago = (datetime.today() - timedelta(days=7)).strftime("%Y%m%d")

        print("\n[pykrx] KOSPI 지수 조회 중...")
        df = stock.get_index_ohlcv(five_days_ago, today, "1001")  # 1001 = KOSPI

        if df.empty:
            print("  → 데이터 없음 (장 휴장 기간일 수 있음)")
            return None

        print(df[["시가", "고가", "저가", "종가", "거래량"]].tail(5).to_string())
        latest = df.iloc[-1]
        print(f"\n  최신 KOSPI 종가: {latest['종가']:,.2f}")
        return df

    except Exception as e:
        print(f"  [오류] KOSPI 지수 조회 실패: {e}")
        return None


# ── 2. pykrx로 삼성전자 주가 조회 ─────────────────────────────────────────
def fetch_samsung_pykrx():
    """pykrx로 삼성전자(005930) 최근 5일 OHLCV를 가져옵니다."""
    try:
        from pykrx import stock

        today = datetime.today().strftime("%Y%m%d")
        five_days_ago = (datetime.today() - timedelta(days=7)).strftime("%Y%m%d")

        print("\n[pykrx] 삼성전자(005930) 주가 조회 중...")
        df = stock.get_market_ohlcv(five_days_ago, today, "005930")

        if df.empty:
            print("  → 데이터 없음")
            return None

        print(df[["시가", "고가", "저가", "종가", "거래량"]].tail(5).to_string())
        latest = df.iloc[-1]
        print(f"\n  최신 삼성전자 종가: {latest['종가']:,}원")
        return df

    except Exception as e:
        print(f"  [오류] 삼성전자 주가 조회 실패: {e}")
        return None


# ── 3. FinanceDataReader로 삼성전자 주가 조회 (백업) ──────────────────────
def fetch_samsung_fdr():
    """FinanceDataReader로 삼성전자(005930) 최근 30일 주가를 가져옵니다."""
    try:
        import FinanceDataReader as fdr

        start = (datetime.today() - timedelta(days=30)).strftime("%Y-%m-%d")
        end = datetime.today().strftime("%Y-%m-%d")

        print("\n[FinanceDataReader] 삼성전자(005930) 조회 중...")
        df = fdr.DataReader("005930", start, end)

        if df.empty:
            print("  → 데이터 없음")
            return None

        print(df[["Open", "High", "Low", "Close", "Volume"]].tail(5).to_string())
        latest = df.iloc[-1]
        print(f"\n  최신 삼성전자 종가(FDR): {latest['Close']:,}원")
        return df

    except Exception as e:
        print(f"  [오류] FinanceDataReader 조회 실패: {e}")
        return None


# ── 4. pykrx 외국인·기관 수급 조회 ────────────────────────────────────────
def fetch_investor_trading():
    """pykrx로 삼성전자 외국인·기관 순매수 데이터를 가져옵니다."""
    try:
        from pykrx import stock

        today = datetime.today().strftime("%Y%m%d")
        three_days_ago = (datetime.today() - timedelta(days=5)).strftime("%Y%m%d")

        print("\n[pykrx] 삼성전자 투자자별 거래 조회 중...")
        df = stock.get_market_trading_value_by_date(three_days_ago, today, "005930")

        if df.empty:
            print("  → 데이터 없음")
            return None

        print(df.tail(3).to_string())
        return df

    except Exception as e:
        print(f"  [오류] 투자자별 거래 조회 실패: {e}")
        return None


# ── 메인 실행 ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("KSI 데이터 수집 테스트")
    print(f"KRX_API_KEY: {'실제 키 사용' if KRX_API_KEY != 'TEST-KRX-API-KEY-PLACEHOLDER' else '임시 키 (미발급 상태)'}")
    print("=" * 60)

    fetch_kospi_index()
    fetch_samsung_pykrx()
    fetch_samsung_fdr()
    fetch_investor_trading()

    print("\n" + "=" * 60)
    print("테스트 완료")
    print("=" * 60)
