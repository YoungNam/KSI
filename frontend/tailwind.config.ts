import type { Config } from "tailwindcss";

const config: Config = {
  // 다크모드: 클래스 기반
  darkMode: ["class"],
  // Tailwind가 스캔할 파일 경로
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // KSI Toss 디자인 토큰 — CSS 변수 기반
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        // Toss 추가 색상 토큰
        success: {
          DEFAULT: "hsl(var(--success))",  /* #05C075 — 상승/매수 */
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",  /* #F5A623 — 중립/관망 */
        },
        // Toss 원색 참조용 (CSS 변수 외 직접 사용 시)
        toss: {
          blue: "#3182F6",
          "blue-hover": "#4D95FF",
          green: "#05C075",
          red: "#F04452",
          amber: "#F5A623",
          bg: "#0E1117",
          card: "#161B27",
          "card-hover": "#1E2535",
          border: "#242D3D",
          text1: "#F0F4FF",
          text2: "#8B96A9",
          text3: "#4E5C72",
        },
      },
      borderRadius: {
        // Toss 반경 시스템
        card: "16px",          /* 카드 기본 */
        badge: "8px",          /* 배지 */
        button: "12px",        /* 버튼 */
        lg: "var(--radius)",   /* 1rem */
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
      },
      fontFamily: {
        // Pretendard 폰트 패밀리
        pretendard: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        // Toss 카드 그림자
        card: "0 2px 12px rgba(0, 0, 0, 0.3)",
        "card-hover": "0 4px 20px rgba(0, 0, 0, 0.4)",
      },
      keyframes: {
        // 로딩 펄스 애니메이션
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        pulse: "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
