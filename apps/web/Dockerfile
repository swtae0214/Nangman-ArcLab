# 8주차: 자체 서버(Raspberry Pi / EC2) 배포용 이미지.
# 반드시 저장소 루트를 빌드 컨텍스트로 써야 한다 (pnpm workspace라 apps/web 혼자서는 못 빌드됨):
#   docker build -f apps/web/Dockerfile -t nangman-web .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# 1) 의존성 설치 — package.json류만 먼저 복사해서 소스가 바뀌어도 이 레이어는 캐시되게 한다.
#    pnpm-lock.yaml이 워크스페이스 전체 기준이라, 안 쓰는 apps/api도 package.json은 같이 넣어야
#    --frozen-lockfile 설치 결과가 lockfile과 정확히 맞는다.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

# 2) 빌드 — shared-types를 먼저 컴파일한 뒤(dist 필요) next build.
#    output:"standalone"에서는 next.config.ts의 rewrites가 빌드 시점에 routes-manifest.json에
#    그대로 구워져서, 컨테이너 실행 시 환경변수를 다시 넘겨줘도 반영이 안 된다(실제로 겪은 버그 —
#    런타임에 API_INTERNAL_URL을 줘도 무시되고 기본값 localhost:4000으로 고정돼있었다).
#    그래서 빌드 시점에 맞는 값을 직접 넣는다 — docker-compose 구성에서 web은 항상 "api"라는
#    서비스 이름으로 API를 찾으므로 이 값은 고정이다.
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web
ENV API_INTERNAL_URL="http://api:4000/api/v1"
RUN pnpm --filter @nangman/shared-types build
RUN pnpm --filter @nangman/web build

# 3) 실행 이미지 — next.config.ts의 output:"standalone" 덕분에 node_modules를 통째로 넣지 않아도 된다.
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web
EXPOSE 3000
CMD ["node", "server.js"]
