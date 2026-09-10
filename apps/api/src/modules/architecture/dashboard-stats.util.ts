import type {
  ArchitectureLatestSimulationSummary,
  ArchitectureValidationSummary,
  RuleSeverity,
  ValidationRuleResult,
} from '@nangman/shared-types';
import { estimateAvailabilityPercent } from '../simulation/availability.util.js';

const SEVERITY_RANK: Record<RuleSeverity, number> = { CRITICAL: 3, WARNING: 2, INFO: 1 };

/** 홈 대시보드 카드의 "위반 N건 · CRITICAL" 배지에 쓸 요약. 실시간 정적 검증 결과(ValidationService.evaluate)를 그대로 압축한다. */
export function summarizeValidation(report: { passed: boolean; results: ValidationRuleResult[] }): ArchitectureValidationSummary {
  const failed = report.results.filter((result) => !result.passed);
  const worstSeverity = failed.reduce<RuleSeverity | null>((worst, result) => {
    if (!worst || SEVERITY_RANK[result.severity] > SEVERITY_RANK[worst]) {
      return result.severity;
    }
    return worst;
  }, null);

  return {
    passed: report.passed,
    totalCount: report.results.length,
    failedCount: failed.length,
    worstSeverity,
    failedRules: failed.map((result) => ({ ruleCode: result.ruleCode, name: result.name, severity: result.severity })),
  };
}

interface DecimalLike {
  toNumber(): number;
}

interface SimulationMetricRowLike {
  scenarioPhase: 'BASELINE' | 'DURING_FAILURE';
  avgLatencyMs: DecimalLike | null;
  throughputRps: DecimalLike;
  isSaturated: boolean;
}

export interface LatestSimulationRunLike {
  createdAt: Date;
  observationPeriodSec: number;
  failureDurationSec: number | null;
  expectedRps: DecimalLike;
  simulationMetrics: SimulationMetricRowLike[];
}

/**
 * SimulationService.listRuns의 toPhaseResultFromRows와 같은 규칙(구간 내 한 곳이라도 포화면
 * 지연시간은 null, 처리량은 포화 구간의 최솟값)을 쓰되, 대시보드 카드 하나에 필요한 값
 * (가용성 %, 평균 지연시간)만 뽑아내는 축약 버전이다. SimulationService 전체를 의존성으로
 * 끌어오면 CatalogService까지 딸려와 ArchitectureModule이 과도하게 커져서, 필요한 순수 계산만
 * 이 파일에 별도로 둔다.
 */
export function summarizeLatestSimulationRun(run: LatestSimulationRunLike): ArchitectureLatestSimulationSummary {
  const expectedRps = run.expectedRps.toNumber();

  const summarizePhase = (rows: SimulationMetricRowLike[]): { endToEndLatencyMs: number | null; throughputRps: number } => {
    if (rows.length === 0) {
      return { endToEndLatencyMs: null, throughputRps: 0 };
    }
    const saturatedRows = rows.filter((row) => row.isSaturated);
    const anySaturated = saturatedRows.length > 0;
    const endToEndLatencyMs = anySaturated
      ? null
      : rows.reduce((sum, row) => sum + (row.avgLatencyMs?.toNumber() ?? 0), 0);
    const throughputRps = anySaturated ? Math.min(...saturatedRows.map((row) => row.throughputRps.toNumber())) : expectedRps;
    return { endToEndLatencyMs, throughputRps };
  };

  const baselineRows = run.simulationMetrics.filter((row) => row.scenarioPhase === 'BASELINE');
  const failureRows = run.simulationMetrics.filter((row) => row.scenarioPhase === 'DURING_FAILURE');
  const baseline = summarizePhase(baselineRows);
  const duringFailure = failureRows.length > 0 ? summarizePhase(failureRows) : null;

  return {
    estimatedAvailabilityPercent: estimateAvailabilityPercent({
      observationPeriodSec: run.observationPeriodSec,
      failureDurationSec: run.failureDurationSec ?? 0,
      expectedRps,
      baselineThroughputRps: baseline.throughputRps,
      duringFailureThroughputRps: duringFailure?.throughputRps ?? null,
    }),
    avgLatencyMs: baseline.endToEndLatencyMs,
    createdAt: run.createdAt.toISOString(),
  };
}
