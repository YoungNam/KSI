import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* KSI 프로젝트 Next.js 설정 */
  reactStrictMode: true,
  // 백엔드 API 프록시 설정 (개발 환경)
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
    if (!apiUrl) return [];

    const destination = apiUrl.startsWith('http')
      ? `${apiUrl}/api/:path*`
      : `https://${apiUrl}/api/:path*`;

    return [
      {
        source: '/api/backend/:path*',
        destination,
      },
    ];
  },
};

export default nextConfig;
