export interface EstimateAvailabilityInput {
  observationPeriodSec: number;
  failureDurationSec: number;
  expectedRps: number;
  baselineThroughputRps: number;
  /** 장애 시나리오를 안 돌렸으면 null — 이 경우 관찰 기간 내내 baseline 상태였다고 본다. */
  duringFailureThroughputRps: number | null;
}

/**
 * 관찰 기간(observationPeriodSec) 동안, 장애 구간(failureDurationSec)엔 장애 중 처리량으로,
 * 나머지 구간엔 평상시(baseline) 처리량으로 돌아갔다고 보고 가중평균한 가용성(%) 추정치.
 * "처리량이 요청량에 못 미친 비율만큼 가용성이 깎인다"는 단순화된 모델이다 — 실제 장애는
 * 완전 다운/부분 성능 저하 등 더 다양하지만, 지금은 큐잉 계산 결과(처리량)만으로 근사한다.
 */
export function estimateAvailabilityPercent({
  observationPeriodSec,
  failureDurationSec,
  expectedRps,
  baselineThroughputRps,
  duringFailureThroughputRps,
}: EstimateAvailabilityInput): number {
  const servedFraction = (throughputRps: number): number => (expectedRps <= 0 ? 1 : Math.min(1, throughputRps / expectedRps));

  const baselineFraction = servedFraction(baselineThroughputRps);
  const failureFraction = duringFailureThroughputRps === null ? baselineFraction : servedFraction(duringFailureThroughputRps);

  const clampedFailureDurationSec = Math.min(Math.max(failureDurationSec, 0), observationPeriodSec);
  const normalDurationSec = observationPeriodSec - clampedFailureDurationSec;

  const weightedFraction = (normalDurationSec * baselineFraction + clampedFailureDurationSec * failureFraction) / observationPeriodSec;
  return weightedFraction * 100;
}
