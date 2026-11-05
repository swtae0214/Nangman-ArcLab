import type {
  ArchitectureGraph,
  ArchitectureValidationReport,
  ComponentPresetCatalogItem,
  CreateSimulationRunRequest,
  NodeCapacityPreviewResult,
  SimulationNodeMetric,
  SimulationPhaseResult,
  SimulationRunResult,
  SimulationRunSummary,
} from '@nangman/shared-types';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ArchitectureService } from '../architecture/architecture.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ValidationService } from '../validation/validation.service.js';
import { estimateAvailabilityPercent } from './availability.util.js';
import { findNodesUnderScope, parseAffectsRule, removeNodesByType } from './failure-scenario.util.js';
import { computePipeline, type PipelineResult } from './pipeline.util.js';
import { calculateMMc } from './queueing.util.js';
import { generateSuggestions } from './suggestions.util.js';

interface FailurePhaseOutcome {
  duringFailurePipeline: PipelineResult | null;
  failureDurationSec: number;
}

@Injectable()
export class SimulationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly architectureService: ArchitectureService,
    private readonly validationService: ValidationService,
    private readonly catalogService: CatalogService,
  ) {}

  async previewNodeCapacity(presetCode: string, instanceCount: number, expectedRps: number): Promise<NodeCapacityPreviewResult> {
    const preset = await this.prisma.componentPreset.findUnique({ where: { code: presetCode } });
    if (!preset) {
      throw new NotFoundException(`프리셋 "${presetCode}"을(를) 찾을 수 없습니다.`);
    }

    try {
      const result = calculateMMc({
        lambdaRps: expectedRps,
        muRps: preset.serviceRateRps.toNumber(),
        instanceCount,
      });

      return {
        lambdaRps: result.lambdaRps,
        muRps: result.muRps,
        instanceCount: result.instanceCount,
        rho: result.rho,
        isSaturated: result.isSaturated,
        waitProbability: result.waitProbability,
        avgQueueLength: result.avgQueueLength,
        avgWaitTimeMs: result.avgWaitTimeMs,
        avgLatencyMs: result.avgLatencyMs,
        throughputRps: result.throughputRps,
      };
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : '계산 중 오류가 발생했습니다.');
    }
  }

  /**
   * 5단계 핵심 엔드포인트. 검증(3단계) + 큐잉 계산(4단계) + 장애 주입을 한 번에 묶어서 실행하고,
   * simulation_runs/validation_results/simulation_metrics에 그대로 남긴다 (재현 가능성을 위한
   * 스냅샷 패턴 — 4단계에서 정한 원칙).
   */
  async runSimulation(architectureId: string, userId: string, request: CreateSimulationRunRequest): Promise<SimulationRunResult> {
    const architecture = await this.architectureService.getOwned(architectureId, userId);
    const presets = await this.catalogService.listComponentPresets();

    const validation = await this.validationService.evaluate(architecture.graph);
    const baselinePipeline = computePipeline(architecture.graph, request.expectedRps, presets);
    const { duringFailurePipeline, failureDurationSec } = await this.runFailurePhase(architecture.graph, request, presets);

    const estimatedAvailabilityPercent = estimateAvailabilityPercent({
      observationPeriodSec: request.observationPeriodSec,
      failureDurationSec,
      expectedRps: request.expectedRps,
      baselineThroughputRps: baselinePipeline.throughputRps,
      duringFailureThroughputRps: duringFailurePipeline?.throughputRps ?? null,
    });

    const warnings = [...baselinePipeline.warnings, ...(duringFailurePipeline?.warnings ?? [])];

    const run = await this.prisma.simulationRun.create({
      data: {
        architectureId,
        architectureSnapshot: architecture.graph as unknown as Prisma.InputJsonValue,
        targetAvailability: request.targetAvailability,
        expectedRps: request.expectedRps,
        failureScenarioCode: request.failureScenarioCode,
        failureDurationSec: request.failureScenarioCode ? failureDurationSec : undefined,
        observationPeriodSec: request.observationPeriodSec,
        validationResults: {
          create: validation.results.map((result) => ({
            ruleCode: result.ruleCode,
            passed: result.passed,
            severityAtRun: result.severity,
            detail: result.detail,
          })),
        },
        simulationMetrics: {
          create: [
            ...toMetricRows(baselinePipeline.nodeMetrics, 'BASELINE'),
            ...(duringFailurePipeline ? toMetricRows(duringFailurePipeline.nodeMetrics, 'DURING_FAILURE') : []),
          ],
        },
      },
    });

    return {
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      input: request,
      validation,
      baseline: toPhaseResult(baselinePipeline),
      duringFailure: duringFailurePipeline ? toPhaseResult(duringFailurePipeline) : null,
      estimatedAvailabilityPercent,
      warnings,
      suggestions: generateSuggestions(validation),
    };
  }

  async getRun(runId: string, userId: string): Promise<SimulationRunResult> {
    const run = await this.prisma.simulationRun.findUnique({
      where: { id: runId },
      include: { architecture: true, validationResults: { include: { rule: true } }, simulationMetrics: true },
    });
    if (!run || (run.architecture.userId !== userId && !run.architecture.isPublic)) {
      throw new NotFoundException('시뮬레이션 실행 결과를 찾을 수 없습니다.');
    }

    const validation: ArchitectureValidationReport = {
      passed: run.validationResults.every((result) => result.passed || result.severityAtRun !== 'CRITICAL'),
      results: run.validationResults.map((result) => ({
        ruleCode: result.ruleCode,
        name: result.rule.name,
        description: result.rule.description,
        severity: result.severityAtRun,
        sourceCitation: result.rule.sourceCitation,
        passed: result.passed,
        detail: result.detail as { nodeIds?: string[] },
      })),
    };

    const expectedRps = run.expectedRps.toNumber();
    const baseline = toPhaseResultFromRows(
      run.simulationMetrics.filter((metric) => metric.scenarioPhase === 'BASELINE'),
      expectedRps,
    );
    const duringFailureRows = run.simulationMetrics.filter((metric) => metric.scenarioPhase === 'DURING_FAILURE');
    const duringFailure = duringFailureRows.length > 0 ? toPhaseResultFromRows(duringFailureRows, expectedRps) : null;

    const estimatedAvailabilityPercent = estimateAvailabilityPercent({
      observationPeriodSec: run.observationPeriodSec,
      failureDurationSec: run.failureDurationSec ?? 0,
      expectedRps: run.expectedRps.toNumber(),
      baselineThroughputRps: baseline.throughputRps,
      duringFailureThroughputRps: duringFailure?.throughputRps ?? null,
    });

    return {
      id: run.id,
      createdAt: run.createdAt.toISOString(),
      input: {
        targetAvailability: run.targetAvailability.toNumber(),
        expectedRps: run.expectedRps.toNumber(),
        failureScenarioCode: run.failureScenarioCode ?? undefined,
        failureDurationSec: run.failureDurationSec ?? undefined,
        observationPeriodSec: run.observationPeriodSec,
      },
      validation,
      baseline,
      duringFailure,
      estimatedAvailabilityPercent,
      warnings: [],
      suggestions: generateSuggestions(validation),
    };
  }

  async listRuns(architectureId: string, userId: string): Promise<SimulationRunSummary[]> {
    await this.architectureService.getOneForOwnerOrPublic(architectureId, userId);

    const runs = await this.prisma.simulationRun.findMany({
      where: { architectureId },
      orderBy: { createdAt: 'desc' },
      include: { validationResults: true, simulationMetrics: true },
    });

    return runs.map((run) => {
      const expectedRps = run.expectedRps.toNumber();
      const baselineRows = run.simulationMetrics.filter((metric) => metric.scenarioPhase === 'BASELINE');
      const failureRows = run.simulationMetrics.filter((metric) => metric.scenarioPhase === 'DURING_FAILURE');
      const baselineThroughput = toPhaseResultFromRows(baselineRows, expectedRps).throughputRps;
      const failureThroughput = failureRows.length > 0 ? toPhaseResultFromRows(failureRows, expectedRps).throughputRps : null;

      return {
        id: run.id,
        createdAt: run.createdAt.toISOString(),
        targetAvailability: run.targetAvailability.toNumber(),
        expectedRps,
        estimatedAvailabilityPercent: estimateAvailabilityPercent({
          observationPeriodSec: run.observationPeriodSec,
          failureDurationSec: run.failureDurationSec ?? 0,
          expectedRps,
          baselineThroughputRps: baselineThroughput,
          duringFailureThroughputRps: failureThroughput,
        }),
        validationPassed: run.validationResults.every((result) => result.passed || result.severityAtRun !== 'CRITICAL'),
      };
    });
  }

  private async runFailurePhase(
    graph: ArchitectureGraph,
    request: CreateSimulationRunRequest,
    presets: ComponentPresetCatalogItem[],
  ): Promise<FailurePhaseOutcome> {
    if (!request.failureScenarioCode) {
      return { duringFailurePipeline: null, failureDurationSec: 0 };
    }

    const scenario = await this.prisma.failureScenario.findUnique({ where: { code: request.failureScenarioCode } });
    if (!scenario) {
      throw new NotFoundException(`장애 시나리오 "${request.failureScenarioCode}"을(를) 찾을 수 없습니다.`);
    }

    const rule = parseAffectsRule(scenario.affectsRule);
    const failureGraph = removeNodesByType(graph, rule.removeNodeTypes);
    const capacityReducedNodeIds = findNodesUnderScope(failureGraph, rule.scope);

    const duringFailurePipeline = computePipeline(failureGraph, request.expectedRps, presets, {
      capacityReducedNodeIds,
      capacityReductionRatio: rule.capacityReductionRatio,
    });

    return { duringFailurePipeline, failureDurationSec: request.failureDurationSec ?? scenario.defaultDurationSec };
  }
}

function toPhaseResult(pipeline: PipelineResult): SimulationPhaseResult {
  return {
    nodeMetrics: pipeline.nodeMetrics,
    endToEndLatencyMs: pipeline.endToEndLatencyMs,
    throughputRps: pipeline.throughputRps,
  };
}

function toMetricRows(metrics: SimulationNodeMetric[], scenarioPhase: 'BASELINE' | 'DURING_FAILURE') {
  return metrics.map((metric) => ({
    nodeId: metric.nodeId,
    nodeType: metric.nodeType,
    scenarioPhase,
    lambdaRps: metric.lambdaRps,
    muRps: metric.muRps,
    cServers: metric.instanceCount,
    rho: metric.rho,
    avgLatencyMs: metric.avgLatencyMs ?? undefined,
    throughputRps: metric.throughputRps,
    isSaturated: metric.isSaturated,
  }));
}

type SimulationMetricRow = {
  nodeId: string;
  nodeType: SimulationNodeMetric['nodeType'];
  lambdaRps: Prisma.Decimal;
  muRps: Prisma.Decimal;
  cServers: number;
  rho: Prisma.Decimal;
  avgLatencyMs: Prisma.Decimal | null;
  throughputRps: Prisma.Decimal;
  isSaturated: boolean;
};

/**
 * pipeline.util.ts의 computeOverallThroughput과 같은 규칙을 쓴다: 포화된 구간이 있으면 그중
 * 가장 낮은 c·μ가 병목, 없으면 들어온 요청(expectedRps)이 그대로 다 처리된 것으로 본다.
 * DB 스냅샷(rows)만 있고 이 실행 당시 expectedRps는 별도로 넘겨받아야 하므로 여기서도
 * pipeline.util.ts의 로직을 그대로 복제한다 — 저장된 값만으로는 원본 계산 함수를 그대로 재사용할 수 없다.
 */
function toPhaseResultFromRows(rows: SimulationMetricRow[], expectedRps: number): SimulationPhaseResult {
  if (rows.length === 0) {
    return { nodeMetrics: [], endToEndLatencyMs: null, throughputRps: 0 };
  }

  const nodeMetrics: SimulationNodeMetric[] = rows.map((row) => ({
    nodeId: row.nodeId,
    nodeType: row.nodeType,
    lambdaRps: row.lambdaRps.toNumber(),
    muRps: row.muRps.toNumber(),
    instanceCount: row.cServers,
    rho: row.rho.toNumber(),
    isSaturated: row.isSaturated,
    avgLatencyMs: row.avgLatencyMs ? row.avgLatencyMs.toNumber() : null,
    throughputRps: row.throughputRps.toNumber(),
  }));

  const saturated = nodeMetrics.filter((metric) => metric.isSaturated);
  const anySaturated = saturated.length > 0;
  const endToEndLatencyMs = anySaturated ? null : nodeMetrics.reduce((sum, metric) => sum + (metric.avgLatencyMs ?? 0), 0);
  const throughputRps = anySaturated ? Math.min(...saturated.map((metric) => metric.throughputRps)) : expectedRps;

  return { nodeMetrics, endToEndLatencyMs, throughputRps };
}
