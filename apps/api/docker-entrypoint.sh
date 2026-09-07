#!/bin/sh
# 컨테이너가 뜰 때마다 대기 중인 마이그레이션을 먼저 적용한다.
# prisma migrate deploy는 이미 적용된 마이그레이션은 건드리지 않으므로 재시작해도 안전하다.
set -e

echo "[entrypoint] prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] starting API server..."
exec "$@"
