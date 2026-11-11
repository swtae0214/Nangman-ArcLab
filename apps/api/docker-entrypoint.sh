#!/bin/sh
# 컨테이너가 뜰 때마다 대기 중인 마이그레이션을 먼저 적용한다.
# prisma migrate deploy는 이미 적용된 마이그레이션은 건드리지 않으므로 재시작해도 안전하다.
set -e

echo "[entrypoint] prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

# 정적 검증 규칙/컴포넌트 프리셋/장애 시나리오 카탈로그 — 전부 upsert라 반복 실행해도 안전하다.
# 이게 없으면(처음 배포한 DB) 정적 검증 근거·용량 계산기 프리셋·시뮬레이션이 전부 빈 채로 뜬다.
echo "[entrypoint] seeding catalog data..."
node dist/scripts/seed-validation-rules.js
node dist/scripts/seed-component-presets.js
node dist/scripts/seed-failure-scenarios.js

echo "[entrypoint] starting API server..."
exec "$@"
