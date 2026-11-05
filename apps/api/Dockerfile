# 8주차: 자체 서버(Raspberry Pi / EC2) 배포용 이미지.
# 반드시 저장소 루트를 빌드 컨텍스트로 써야 한다 (pnpm workspace라 apps/api 혼자서는 못 빌드됨):
#   docker build -f apps/api/Dockerfile -t nangman-api .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# 1) 의존성 설치 — package.json류만 먼저 복사해서 소스가 바뀌어도 이 레이어는 캐시되게 한다.
#    apps/web은 이 이미지에 안 쓰지만, pnpm-lock.yaml이 4개 워크스페이스 전체를 기준으로 만들어져 있어서
#    package.json이 일부만 있으면 --frozen-lockfile 설치 결과가 lockfile과 어긋난다(devDependencies 누락 등).
#    그래서 워크스페이스 멤버 전체의 package.json을 다 복사해 정확히 lockfile과 맞춰 설치한다.
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

# 2) 빌드 — shared-types를 먼저 컴파일한 뒤(dist 필요), prisma client 생성 후 nest build.
FROM deps AS build
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN pnpm --filter @nangman/shared-types build
# prisma generate는 실제로 DB에 접속하지 않고 스키마만 보고 클라이언트 코드를 만들지만,
# prisma.config.ts가 DATABASE_URL이 "존재하는지" 자체는 확인해서 빌드 단계에서 실패한다.
# 이 값은 이 build 스테이지에만 있고 최종 이미지(runtime)에는 전혀 안 남는다 — 실제 접속 정보는
# 컨테이너가 실행될 때 docker-compose.prod.yml의 environment로 넘어오는 값을 쓴다.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm --filter @nangman/api exec prisma generate
RUN pnpm --filter @nangman/api build

# 3) 실행 이미지 — pnpm workspace의 symlink 구조(node_modules/@nangman/shared-types -> ../../packages/shared-types)를
#    그대로 써야 하므로, apps/api만 떼어가지 않고 모노레포 레이아웃을 유지한 채 필요한 것만 복사한다.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
# pnpm은 각 워크스페이스 패키지 안에도 자기 몫의 node_modules/.bin(예: prisma CLI 심볼릭 링크)을 만들어두므로
# 루트 node_modules만으로는 부족하다 — apps/api 쪽 것도 그대로 가져와야 entrypoint의 prisma 명령이 동작한다.
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=build /app/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

WORKDIR /app/apps/api
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
