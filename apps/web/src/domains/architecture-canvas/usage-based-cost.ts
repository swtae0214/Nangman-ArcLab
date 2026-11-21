/**
 * F4: CDN(CloudFront)과 LOAD_BALANCER(ALB)는 EC2/RDS/ElastiCache와 달리 "인스턴스 하나당 고정 요금"이
 * 아니라 트래픽 사용량에 따라 과금되는 서비스라, component_presets 카탈로그(AWS Price List Bulk API)로는
 * 가격을 받아올 수 없다. 대신 AWS 공식 가격 페이지(2026-11 기준, 아래 출처)에서 직접 확인한 단가를
 * 이 파일에 상수로 박아두고, 트래픽 전파 엔진이 계산한 RPS를 입력 삼아 월 비용을 계산한다.
 *
 * 출처:
 * - ALB: https://aws.amazon.com/elasticloadbalancing/pricing/ (us-east-1 예시 기준 $0.0225/ALB-시간, $0.008/LCU-시간)
 * - CloudFront: https://aws.amazon.com/cloudfront/pricing/pay-as-you-go/
 *   ("Hong Kong, Indonesia, Philippines, Singapore, South Korea, Taiwan, Thailand, Malaysia, and Vietnam" 열 — 대한민국 포함)
 */

const SECONDS_PER_MONTH = 30 * 24 * 60 * 60;
/** 이 파일의 GB 계산은 모두 10진 단위(1GB = 1,000,000KB)를 쓴다 — AWS 가격표 예시 계산과 같은 방식. */
const KB_PER_GB = 1_000_000;

// ── ALB(Application Load Balancer) ──────────────────────────────────────────

const ALB_HOURLY_USD = 0.0225;
const ALB_LCU_HOURLY_USD = 0.008;
/** LCU 1개 = 신규 연결 초당 25개(AWS 공식 정의). */
const ALB_NEW_CONNECTIONS_PER_LCU = 25;

export interface AlbCostInput {
  /** 이 로드밸런서에 도착하는 RPS(트래픽 전파 엔진 계산값). */
  rps: number;
  /** 연결을 재사용(keep-alive)하는지. false면 요청마다 새 연결을 맺는다고 본다. */
  connectionReuse: boolean;
  /** connectionReuse가 true일 때만 의미 있음 — 연결 하나당 평균 요청 수. */
  requestsPerConnection?: number;
}

export interface AlbCostResult {
  newConnectionsPerSec: number;
  lcuFromNewConnections: number;
  monthlyCostUsd: number;
}

/**
 * LCU는 "신규 연결/활성 연결/처리 데이터/규칙 평가" 4가지 차원 중 가장 큰 값으로 매겨지는데, 활성
 * 연결·처리 데이터·규칙 평가 차원은 연결 유지시간 등 검증되지 않은 가정이 필요해서 반영하지 않는다
 * (성우와 상의해 범위를 좁힌 부분 — 2026-11 결정). 신규 연결 차원만으로 계산하므로, 실제 청구액은
 * 이 값보다 클 수 있다는 걸 항상 같이 보여줘야 한다.
 */
export function computeAlbCost(input: AlbCostInput): AlbCostResult | null {
  const newConnectionsPerSec = input.connectionReuse
    ? input.requestsPerConnection && input.requestsPerConnection > 0
      ? input.rps / input.requestsPerConnection
      : null
    : input.rps;
  if (newConnectionsPerSec === null) return null;

  const lcuFromNewConnections = newConnectionsPerSec / ALB_NEW_CONNECTIONS_PER_LCU;
  const monthlyCostUsd = (ALB_HOURLY_USD + lcuFromNewConnections * ALB_LCU_HOURLY_USD) * 730;
  return { newConnectionsPerSec, lcuFromNewConnections, monthlyCostUsd: Math.round(monthlyCostUsd * 100) / 100 };
}

// ── CDN(CloudFront) ──────────────────────────────────────────────────────────

/** 대한민국이 포함된 열 기준 — 데이터 전송(GB당 USD) 누진 구간. */
const CLOUDFRONT_KR_TRANSFER_TIERS: { upToGb: number; usdPerGb: number }[] = [
  { upToGb: 1_000, usdPerGb: 0 },
  { upToGb: 10_000, usdPerGb: 0.12 },
  { upToGb: 50_000, usdPerGb: 0.1 },
  { upToGb: 150_000, usdPerGb: 0.095 },
  { upToGb: 500_000, usdPerGb: 0.09 },
  { upToGb: 1_024_000, usdPerGb: 0.08 },
  { upToGb: 5_024_000, usdPerGb: 0.07 },
  { upToGb: Infinity, usdPerGb: 0.06 },
];
const CLOUDFRONT_KR_FREE_REQUESTS_PER_MONTH = 10_000_000;
const CLOUDFRONT_KR_HTTPS_USD_PER_10K_REQUESTS = 0.012;

function computeTieredTransferCostUsd(totalGb: number): number {
  let remaining = totalGb;
  let previousThreshold = 0;
  let cost = 0;
  for (const tier of CLOUDFRONT_KR_TRANSFER_TIERS) {
    const tierSizeGb = tier.upToGb - previousThreshold;
    const gbInTier = Math.min(remaining, tierSizeGb);
    cost += gbInTier * tier.usdPerGb;
    remaining -= gbInTier;
    previousThreshold = tier.upToGb;
    if (remaining <= 0) break;
  }
  return cost;
}

export interface CdnCostInput {
  /** 이 CDN에 도착하는(= 뷰어가 보낸) RPS — 캐시 적중 여부와 무관하게 전부 응답을 내려준다. */
  rps: number;
  /** 평균 응답 크기(KB) — USER 입구 노드의 전역 가정을 그대로 쓰거나, 필요하면 재정의한다. */
  avgResponseSizeKb: number;
}

export interface CdnCostResult {
  monthlyRequests: number;
  monthlyTransferGb: number;
  requestCostUsd: number;
  transferCostUsd: number;
  monthlyCostUsd: number;
}

/**
 * 캐시 적중률은 이 비용에 영향을 주지 않는다 — CloudFront는 캐시가 맞든 틀리든 뷰어에게 응답을
 * 내려주고 그만큼 과금되기 때문이다(적중률은 대신 origin으로 가는 트래픽을 줄여서 뒷단 비용에
 * 영향을 준다 — traffic-rps.ts의 CDN pass-through 처리 참고).
 */
export function computeCdnCost(input: CdnCostInput): CdnCostResult {
  const monthlyRequests = input.rps * SECONDS_PER_MONTH;
  const monthlyTransferGb = (input.rps * input.avgResponseSizeKb * SECONDS_PER_MONTH) / KB_PER_GB;

  const billableRequests = Math.max(0, monthlyRequests - CLOUDFRONT_KR_FREE_REQUESTS_PER_MONTH);
  const requestCostUsd = (billableRequests / 10_000) * CLOUDFRONT_KR_HTTPS_USD_PER_10K_REQUESTS;
  const transferCostUsd = computeTieredTransferCostUsd(monthlyTransferGb);

  return {
    monthlyRequests,
    monthlyTransferGb,
    requestCostUsd: Math.round(requestCostUsd * 100) / 100,
    transferCostUsd: Math.round(transferCostUsd * 100) / 100,
    monthlyCostUsd: Math.round((requestCostUsd + transferCostUsd) * 100) / 100,
  };
}
