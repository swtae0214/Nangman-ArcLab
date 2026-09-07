const MS_PER_SEC = 1000;

export interface MMcInput {
  /** 도착률 λ (초당 요청 수) */
  lambdaRps: number;
  /** 서버 1대의 처리율 μ (초당 처리 가능 요청 수) */
  muRps: number;
  /** 서버(인스턴스) 대수 c */
  instanceCount: number;
}

export interface MMcResult {
  lambdaRps: number;
  muRps: number;
  instanceCount: number;
  /** 서버 이용률 ρ = (λ/μ) / c. 1 이상이면 처리 능력을 넘어선 것이다. */
  rho: number;
  isSaturated: boolean;
  /** Erlang C 공식 값 — 요청이 대기해야 할 확률 */
  waitProbability: number;
  /** 평균 대기 중인 요청 수 (Lq) */
  avgQueueLength: number;
  avgWaitTimeMs: number;
  /** 대기 시간 + 서비스 시간 (W) */
  avgLatencyMs: number;
  throughputRps: number;
}

/**
 * M/M/c 큐잉 모델(Erlang C)로 단일 노드의 지연시간/처리량을 계산한다 (3단계 설계).
 *
 * ρ ≥ 1(서버가 감당 못 하는 상태)에서는 Erlang C 공식의 (1-ρ) 항이 0 이하가 되어 수식이
 * 발산하므로, 이 경우엔 공식을 계산하지 않고 "포화 상태"로 바로 처리한다 — 이때 처리량은
 * 들어오는 요청량(λ)이 아니라 서버가 낼 수 있는 최대치(c·μ)로 잘린다.
 */
export function calculateMMc({ lambdaRps, muRps, instanceCount }: MMcInput): MMcResult {
  if (lambdaRps < 0 || muRps <= 0 || instanceCount < 1 || !Number.isInteger(instanceCount)) {
    throw new Error('lambdaRps는 0 이상, muRps는 0보다 커야 하며, instanceCount는 1 이상의 정수여야 합니다.');
  }

  const offeredLoad = lambdaRps / muRps; // a = λ/μ (Erlang 단위)
  const rho = offeredLoad / instanceCount;

  if (rho >= 1) {
    return {
      lambdaRps,
      muRps,
      instanceCount,
      rho,
      isSaturated: true,
      waitProbability: 1,
      avgQueueLength: Infinity,
      avgWaitTimeMs: Infinity,
      avgLatencyMs: Infinity,
      throughputRps: instanceCount * muRps,
    };
  }

  if (lambdaRps === 0) {
    return {
      lambdaRps,
      muRps,
      instanceCount,
      rho: 0,
      isSaturated: false,
      waitProbability: 0,
      avgQueueLength: 0,
      avgWaitTimeMs: 0,
      avgLatencyMs: (1 / muRps) * MS_PER_SEC,
      throughputRps: 0,
    };
  }

  // P0 = [ Σ(n=0→c-1) aⁿ/n!  +  a^c / (c!(1-ρ)) ]⁻¹
  let sumOfTerms = 0;
  let factorial = 1; // 루프 각 단계에서 n!을 누적한다
  for (let n = 0; n < instanceCount; n += 1) {
    if (n > 0) factorial *= n;
    sumOfTerms += offeredLoad ** n / factorial;
  }
  const instanceCountFactorial = factorial * instanceCount; // 루프 종료 시 factorial = (c-1)!, 여기에 c를 곱하면 c!
  const lastTerm = offeredLoad ** instanceCount / (instanceCountFactorial * (1 - rho));
  const p0 = 1 / (sumOfTerms + lastTerm);

  const waitProbability = lastTerm * p0; // Erlang C, C(c,a)
  const avgQueueLength = (waitProbability * rho) / (1 - rho); // Lq
  const avgWaitTimeSec = avgQueueLength / lambdaRps; // Wq
  const avgLatencySec = avgWaitTimeSec + 1 / muRps; // W

  return {
    lambdaRps,
    muRps,
    instanceCount,
    rho,
    isSaturated: false,
    waitProbability,
    avgQueueLength,
    avgWaitTimeMs: avgWaitTimeSec * MS_PER_SEC,
    avgLatencyMs: avgLatencySec * MS_PER_SEC,
    throughputRps: lambdaRps,
  };
}
