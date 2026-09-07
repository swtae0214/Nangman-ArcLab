import type { NextConfig } from "next";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:4000/api/v1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // 자체 서버(Raspberry Pi/EC2) 배포용: node_modules를 통째로 넣지 않고 실행에 필요한 파일만
  // .next/standalone에 모아주므로 Docker 이미지가 훨씬 작고 가벼워진다.
  output: "standalone",
  // CLAUDE.md 개발 원칙: 백엔드는 외부에 직접 노출하지 않고 프록시를 통해서만 호출한다.
  // 브라우저는 항상 /api/backend/* (같은 출처)만 호출하고, Next 서버가 실제 NestJS로 중계한다.
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${API_INTERNAL_URL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
