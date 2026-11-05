# Nangman-ArchLab

고가용성/대규모 클라우드 인프라 아키텍처를 **직접 설계하고, 그 설계가 실제로 버틸 수 있는지 시뮬레이션으로 검증**해보는 GUI 학습 서비스입니다.

로드밸런서·웹 서버·DB·캐시 같은 컴포넌트를 캔버스에 드래그해서 배치하면,

1. **정적 검증**으로 "이 설계에 단일 장애점(SPOF)이 있는가, Multi-AZ로 이중화되어 있는가" 같은 구조적 문제를 즉시 찾아주고,
2. **큐잉 이론(M/M/c) 기반 시뮬레이션**으로 "이 설계가 목표 RPS와 목표 가용성을 실제로 만족하는가", "장애가 나면 지연시간/처리량이 어떻게 무너지는가"를 숫자로 보여줍니다.

## 핵심 기능

- **아키텍처 캔버스** — [React Flow](https://reactflow.dev/) 기반 드래그앤드롭 에디터. LB/웹 서버/DB Primary·Replica/캐시/CDN 등 AWS 공식 아이콘 컴포넌트를 배치·연결하고, Auto Scaling Group / Multi-AZ / Multi-Region 그룹으로 묶을 수 있습니다.
- **정적 검증 엔진** — AWS Well-Architected Framework Reliability Pillar를 근거로 한 5개 규칙(SPOF 탐지, DB/캐시 Multi-AZ 구성, 웹 서버 Auto Scaling, DB Replica 존재 여부)을 그래프에 대해 실행하고, 위반 컴포넌트를 캔버스에 빨간 테두리로 표시합니다.
- **시뮬레이션 엔진** — 그래프를 Jackson Network로 보고 각 노드를 M/M/c(Erlang C) 큐로 계산해, 평상시/장애 주입 시의 종단 지연시간·처리량과 추정 가용성(%)을 산출합니다.
- **공유 & Export** — 읽기 전용 공유 링크 발급, 캔버스를 PNG/PDF로 내보내기.

## 기술 스택

| 영역 | 스택 |
|---|---|
| 프론트엔드 | Next.js 16(App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS · React Flow · TanStack Query · react-hook-form + zod |
| 백엔드 | NestJS 12 (ESM) · TypeScript · Prisma 7 (driver adapter) · class-validator |
| DB | PostgreSQL 17 (Docker Compose) |
| 테스트 | Vitest(API 유닛), Playwright(E2E) |
| 모노레포 | pnpm workspace (`apps/web`, `apps/api`, `packages/shared-types`) |

## 프로젝트 구조

```
apps/
  web/                # Next.js 프론트엔드
  api/                # NestJS 백엔드
packages/
  shared-types/        # 프론트/백엔드가 공유하는 타입(zod 스키마 포함 예정)
e2e/                    # Playwright 핵심 플로우 E2E 테스트
docker-compose.yml      # 로컬 PostgreSQL
```

프론트엔드는 백엔드를 직접 호출하지 않고, `next.config.ts`의 rewrites 프록시(`/api/backend/*` → NestJS)를 통해서만 통신합니다. 로그인은 **GitHub OAuth**로만 받고(비밀번호 없음), 로그인 성공 시 서명된 세션 쿠키(httpOnly, `archlab_session`)를 발급합니다. 아키텍처는 전부 소유자(로그인한 계정)만 수정할 수 있고, `share_token`(공개 읽기 전용 링크)으로만 로그인 없이 열람을 허용합니다.

## 로컬에서 실행하기

### 요구사항

- Node.js 22+ / pnpm 10+
- Docker Desktop (PostgreSQL 컨테이너용)

### 1) 설치 및 환경변수

```bash
pnpm install
cp .env.example .env               # 필요하면 값 수정
cp apps/api/.env.example apps/api/.env
```

로그인은 GitHub OAuth로만 되므로, [GitHub 개발자 설정](https://github.com/settings/developers)에서 OAuth App을 하나 등록해야 합니다.

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/backend/auth/github/callback`

등록 후 나오는 Client ID/Secret을 `apps/api/.env`의 `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`에 넣습니다.

### 2) DB 실행 + 마이그레이션

```bash
pnpm db:up
pnpm --filter @nangman/api exec prisma migrate deploy
```

### 3) 개발 서버 실행

```bash
pnpm dev:api   # http://localhost:4000
pnpm dev:web   # http://localhost:3000
```

> ⚠️ Next.js dev 서버(Turbopack)는 정적/HMR 자산 요청을 origin 기준으로 검증하기 때문에, 반드시 **`localhost:3000`**으로 접속해야 합니다. `127.0.0.1:3000`으로 접속하면 자산 요청이 403으로 막혀 화면이 계속 "불러오는 중..."에 머무릅니다.

### 4) 테스트

```bash
pnpm test          # API 유닛 테스트 (Vitest)
pnpm build          # 전체 워크스페이스 빌드
pnpm test:e2e        # 핵심 플로우 E2E (Playwright) — web/api dev 서버가 떠 있어야 함
```

## 정적 검증 규칙

| 코드 | 이름 | 심각도 | 근거 |
|---|---|---|---|
| SPOF-001 | 단일 장애점(SPOF) 탐지 | CRITICAL | REL 11 |
| MULTIAZ-001 | DB의 Multi-AZ 구성 여부 | CRITICAL | REL 10 |
| MULTIAZ-002 | 캐시의 Multi-AZ 구성 여부 | WARNING | REL 10 |
| ASG-001 | 웹 서버 계층의 Auto Scaling 여부 | WARNING | REL 7 |
| DB-002 | 읽기 확장을 위한 DB Replica 존재 여부 | INFO | REL 7 |

## 배포 (자체 서버: Raspberry Pi / EC2 + NAS PostgreSQL)

이 프로젝트는 Vercel 같은 매니지드 호스팅 대신, **직접 관리하는 서버(라즈베리파이 또는 EC2)에 Docker로 배포**하는 걸 기준으로 합니다. DB는 앱 서버가 아니라 **Docker를 지원하는 NAS(Synology/QNAP 등)에서 별도로** 띄우는 구성입니다.

> ⚠️ S3는 파일(객체) 저장소라 PostgreSQL 같은 "살아있는 DB 서버"를 그 위에서 직접 돌릴 수 없습니다. DB 백업 파일 보관 용도로만 쓰세요.

### 구조

```
[NAS]  Docker로 PostgreSQL 컨테이너 실행 (로컬 네트워크에 5432 포트 개방)
  ↑ (DATABASE_URL로 접속)
[Pi 또는 EC2]  docker-compose.prod.yml로 api(4000) + web(3000) 컨테이너 실행
```

### 1) NAS에 PostgreSQL 띄우기

NAS의 Docker(Synology는 Container Manager, QNAP은 Container Station)에서 이 저장소의 `docker-compose.yml`과 같은 이미지(`postgres:17-alpine`)로 컨테이너를 하나 만들고, **다른 기기에서도 접속 가능하도록 포트(5432)를 개방**하세요. NAS의 로컬 IP(예: `192.168.0.50`)를 기억해두면 다음 단계에서 씁니다.

### 2) GitHub OAuth App 등록 (운영용, 로컬 개발용과 별개)

로그인 쿠키는 HTTPS 연결에서만 저장되도록 되어 있어서, **외부에 공개하는 서버는 HTTPS가 사실상 필수**입니다(3번에서 Caddy로 자동 처리). [GitHub 개발자 설정](https://github.com/settings/developers)에서 OAuth App을 하나 더 등록하세요(로컬 개발용과는 별도 앱이어야 합니다):

- Homepage URL: `https://<실제_도메인>`
- Authorization callback URL: `https://<실제_도메인>/api/backend/auth/github/callback`

### 3) 앱 서버(Pi/EC2)에 코드 준비 + 환경변수 설정

```bash
git clone <이 저장소 주소> && cd Nangman-ArchLab
cp .env.production.example .env.production
# .env.production을 열어 DATABASE_URL(NAS IP), COOKIE_SECRET, GITHUB_CLIENT_ID/SECRET(2번에서 받은 값),
# WEB_ORIGIN(https://실제_도메인), DOMAIN(실제_도메인)을 채운다
```

### 4) 도메인 DNS 연결

도메인을 등록한 곳(가비아, Namecheap, 또는 DuckDNS 같은 무료 동적 DNS)에서 **A 레코드**를 이 서버의 공인 IP로 연결합니다. 공유기 뒤에 있다면 80/443 포트를 서버로 포트포워딩해야 합니다.

### 5) 빌드 + 실행

외부 인터넷에 공개할 경우(HTTPS 필요):

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.caddy.yml --env-file .env.production up -d --build
```

도메인 없이 로컬 네트워크(또는 Tailscale 같은 사설 VPN)에서만 쓸 거라면 Caddy 없이 이렇게만 실행해도 됩니다 — 이 경우 로그인은 안 되니, 서비스를 쓰려면 위 외부 공개 구성이 필요합니다:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

- `api` 컨테이너는 시작할 때마다 `prisma migrate deploy`를 먼저 실행하므로(`apps/api/docker-entrypoint.sh`), 마이그레이션을 손으로 따로 돌릴 필요가 없습니다.
- 라즈베리파이(ARM64)든 EC2(x86_64)든 **같은 Dockerfile로 그대로 빌드**됩니다 — Prisma 7의 드라이버 어댑터 방식(`@prisma/adapter-pg`)이라 아키텍처별 네이티브 엔진 바이너리를 따로 고민할 필요가 없습니다.
- Caddy는 처음 뜰 때 Let's Encrypt로 인증서를 자동 발급받고, 이후 만료 전에 알아서 갱신합니다 — 따로 할 일이 없습니다.
- 방화벽(ufw 등)을 쓴다면 **80, 443만 외부에 열고 3000, 4000은 막아도 됩니다** — 외부에선 전부 Caddy를 거쳐 들어오기 때문입니다.

## 알려진 한계 / 다음에 할 일

- **GENERIC_GROUP(단순 그룹) 드래그 시 멤버가 같이 움직이지 않는 경우가 있음** — React Flow의 다중 선택 드래그가 "드래그 시작 시점에 이미 선택돼 있어야" 정상 동작하는 제약과 부딪히는 부분으로, 수동 delta 전파로 1차 완화했지만 완전히 매끄럽지는 않습니다.
- **Export는 서버 렌더링(Puppeteer)이 아니라 클라이언트 캡처(`html-to-image` + `jsPDF`) 방식** — 인프라 관리 부담을 줄이기 위한 선택이며, 현재 화면에 보이는 영역만 캡처됩니다(전체 캔버스 자동 스크롤/합성은 하지 않음).
- 시뮬레이션은 정상상태(steady-state) M/M/c 근사이며, 실제 버스트 트래픽이나 큐 길이 제한 같은 요소는 반영하지 않습니다.
- 로그인 세션은 서버가 재시작돼도 유지되지만(쿠키 1년), 서버 쪽에 "지금 로그인된 세션 목록"을 따로 저장하지는 않습니다 — "다른 모든 기기에서 로그아웃" 같은 기능은 없습니다.
