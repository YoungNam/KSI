import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* KSI 프로젝트 Next.js 설정 */
  reactStrictMode: true,
  // 백엔드 API 프록시 설정 (개발 환경)
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
