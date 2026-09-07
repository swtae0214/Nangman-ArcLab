import type { ArchitectureValidationReport } from './validation.js';
import type { ComponentType } from './architecture.js';

/** component_presets 카탈로그 — 컴포넌트 타입별 처리 능력(μ) 추정치. */
export interface ComponentPresetCatalogItem {
  code: string;
  componentType: ComponentType;
  displayName: string;
  serviceRateRps: number;
  sourceNote: string;
}

export interface NodeCapacityPreviewRequest {
  presetCode: string;
  instanceCount: number;
  expectedRps: number;
}

/**
 * 3단계에서 설계한 단일 노드 M/M/c(Erlang C) 계산 결과.
 * isSaturated가 true면 대기시간이 수학적으로 무한대라 JSON으로 표현할 수 없어 null로 내려온다 —
 * 화면에서는 반드시 isSaturated를 먼저 확인하고 null을 "포화 상태"로 보여줘야 한다.
 */
export interface NodeCapacityPreviewResult {
  lambdaRps: number;
  muRps: number;
  instanceCount: number;
  rho: number;
  isSaturated: boolean;
  waitProbability: number;
  avgQueueLength: number | null;
  avgWaitTimeMs: number | null;
  avgLatencyMs: number | null;
  throughputRps: number;
}

/** failure_scenarios 카탈로그. */
export interface FailureScenarioCatalogItem {
  code: string;
  displayName: string;
  description: string;
  defaultDurationSec: number;
}

export interface CreateSimulationRunRequest {
  targetAvailability: number;
  expectedRps: number;
  failureScenarioCode?: string;
  failureDurationSec?: number;
  observationPeriodSec: number;
}

/** 5단계에서 설계한 노드/구간별 큐잉 계산 결과. */
export interface SimulationNodeMetric {
  nodeId: string;
  nodeType: ComponentType;
  lambdaRps: number;
  muRps: number;
  instanceCount: number;
  rho: number;
  isSaturated: boolean;
  avgLatencyMs: number | null;
  throughputRps: number;
}

export interface SimulationPhaseResult {
  nodeMetrics: SimulationNodeMetric[];
  /** 경로 위 어느 한 곳이라도 포화 상태면 유한한 지연시간을 말할 수 없어 null이 된다. */
  endToEndLatencyMs: number | null;
  /** 경로 전체의 실제 처리량 — 포화된 구간이 있으면 그 한계치(c·μ), 없으면 들어온 요청량 그대로. */
  throughputRps: number;
}

export interface SimulationRunResult {
  id: string;
  createdAt: string;
  input: CreateSimulationRunRequest;
  validation: ArchitectureValidationReport;
  baseline: SimulationPhaseResult;
  duringFailure: SimulationPhaseResult | null;
  /** 관찰 기간 대비, 장애 구간 동안의 처리량 저하까지 반영한 가용성 추정치(%). */
  estimatedAvailabilityPercent: number;
  /** 프리셋 미지정 등으로 기본값/가정을 사용했을 때 알려주는 문구. */
  warnings: string[];
  /** 실패한 검증 규칙을 바탕으로 만든 개선 제안 (6단계). */
  suggestions: string[];
}

export interface SimulationRunSummary {
  id: string;
  createdAt: string;
  targetAvailability: number;
  expectedRps: number;
  estimatedAvailabilityPercent: number;
  validationPassed: boolean;
}
