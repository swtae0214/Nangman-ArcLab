import type { ArchitectureDashboardSummary } from "@nangman/shared-types";

export interface DashboardAggregateStats {
  architectureCount: number;
  /** 시뮬레이션을 한 번도 안 돌린 아키텍처는 평균에서 제외한다. 전부 안 돌렸으면 null. */
  avgEstimatedAvailabilityPercent: number | null;
  avgLatencyMs: number | null;
  unresolvedViolationCount: number;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** 대시보드 상단 요약 카드 4개(평균 가용성/평균 지연시간/미해결 위반/저장된 설계)에 쓸 집계.
 *  카드마다 이미 계산돼서 내려오는 값을 프론트에서 reduce만 하면 돼서, 백엔드에 별도 집계
 *  엔드포인트를 추가하지 않았다. */
export function computeDashboardAggregateStats(architectures: ArchitectureDashboardSummary[]): DashboardAggregateStats {
  const withSimulation = architectures.filter(
    (architecture): architecture is ArchitectureDashboardSummary & { latestSimulation: NonNullable<ArchitectureDashboardSummary["latestSimulation"]> } =>
      architecture.latestSimulation !== null,
  );

  const availabilityValues = withSimulation.map((architecture) => architecture.latestSimulation.estimatedAvailabilityPercent);
  const latencyValues = withSimulation
    .map((architecture) => architecture.latestSimulation.avgLatencyMs)
    .filter((value): value is number => value !== null);

  return {
    architectureCount: architectures.length,
    avgEstimatedAvailabilityPercent: average(availabilityValues),
    avgLatencyMs: average(latencyValues),
    unresolvedViolationCount: architectures.reduce((sum, architecture) => sum + architecture.validation.failedCount, 0),
  };
}
