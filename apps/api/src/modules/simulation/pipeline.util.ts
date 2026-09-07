import type { ArchitectureGraph, ComponentPresetCatalogItem, ComponentType, GraphNode } from '@nangman/shared-types';
import {
  bfsReachable,
  buildDirectedAdjacency,
  buildNodesById,
  buildReverseAdjacency,
} from '../validation/graph.util.js';
import { calculateMMc } from './queueing.util.js';

/** 캐시 적중률은 아직 사용자가 조절할 수 없어서 고정값으로 가정한다 (3단계에서 이미 밝힌 한계). */
export const DEFAULT_CACHE_HIT_RATIO = 0.7;
const DEFAULT_MU_RPS_FALLBACK = 100;

export interface PipelineNodeMetric {
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

export interface PipelineResult {
  nodeMetrics: PipelineNodeMetric[];
  endToEndLatencyMs: number | null;
  throughputRps: number;
  warnings: string[];
}

export interface PipelineOptions {
  /** 이 노드 id들의 인스턴스 수를 capacityReductionRatio만큼 줄인다 (장애 주입 — 5단계). */
  capacityReducedNodeIds?: Set<string>;
  capacityReductionRatio?: number;
}

function resolveMuRps(
  node: GraphNode,
  presetsByCode: Map<string, ComponentPresetCatalogItem>,
  defaultPresetByType: Map<ComponentType, ComponentPresetCatalogItem>,
  warnings: string[],
): number {
  const preset = node.data.presetCode ? presetsByCode.get(node.data.presetCode) : undefined;
  if (preset) return preset.serviceRateRps;

  const fallback = defaultPresetByType.get(node.type);
  if (fallback) {
    warnings.push(`"${node.data.label}" 노드에 프리셋이 지정되지 않아 기본값(${fallback.displayName})으로 계산했습니다.`);
    return fallback.serviceRateRps;
  }
  warnings.push(`"${node.data.label}" 노드의 처리 능력을 알 수 없어 임시값(초당 ${DEFAULT_MU_RPS_FALLBACK}건)으로 계산했습니다.`);
  return DEFAULT_MU_RPS_FALLBACK;
}

/**
 * 5단계 설계: 그래프를 Jackson Network로 보고, 로드밸런서→(웹서버)→(캐시)→DB 경로를 따라
 * 구간별 M/M/c를 계산한 뒤 이어 붙인다.
 *
 * 단순화한 점(정직하게 밝혀둔다):
 * - 여러 LB/여러 병렬 웹서버 그룹이 있어도 트래픽을 나누지 않고, 각 그룹이 전체 요청(expectedRps)을
 *   다 받는다고 가정한다 (라우팅 비율을 사용자가 입력할 방법이 아직 없어서다).
 * - 캐시 적중률은 DEFAULT_CACHE_HIT_RATIO로 고정한다.
 * - DB_PRIMARY/DB_REPLICA는 각각 독립된 병목 후보로만 보고, 서로의 부하를 나누지 않는다.
 */
export function computePipeline(
  graph: ArchitectureGraph,
  expectedRps: number,
  presets: ComponentPresetCatalogItem[],
  options: PipelineOptions = {},
): PipelineResult {
  const warnings: string[] = [];
  const nodesById = buildNodesById(graph);
  const presetsByCode = new Map(presets.map((preset) => [preset.code, preset]));
  const defaultPresetByType = new Map<ComponentType, ComponentPresetCatalogItem>();
  for (const preset of presets) {
    if (!defaultPresetByType.has(preset.componentType)) defaultPresetByType.set(preset.componentType, preset);
  }

  const lbIds = graph.nodes.filter((node) => node.type === 'LOAD_BALANCER').map((node) => node.id);
  const dbIds = graph.nodes.filter((node) => node.type === 'DB_PRIMARY' || node.type === 'DB_REPLICA').map((node) => node.id);

  if (lbIds.length === 0 || dbIds.length === 0) {
    return {
      nodeMetrics: [],
      endToEndLatencyMs: null,
      throughputRps: 0,
      warnings: ['로드밸런서와 DB가 모두 있어야 트래픽 경로를 계산할 수 있습니다.'],
    };
  }

  const reachableFromLb = bfsReachable(buildDirectedAdjacency(graph), lbIds);
  const canReachDb = bfsReachable(buildReverseAdjacency(graph), dbIds);

  const relevantIds = new Set(
    graph.nodes
      .filter((node) => reachableFromLb.has(node.id) && canReachDb.has(node.id))
      .filter(
        (node) => node.type === 'WEB_SERVER' || node.type === 'CACHE' || node.type === 'DB_PRIMARY' || node.type === 'DB_REPLICA',
      )
      .map((node) => node.id),
  );

  if (relevantIds.size === 0) {
    return {
      nodeMetrics: [],
      endToEndLatencyMs: null,
      throughputRps: 0,
      warnings: ['로드밸런서에서 DB까지 이어지는 트래픽 경로를 찾지 못했습니다. 연결선을 확인하세요.'],
    };
  }

  const hasCache = [...relevantIds].some((id) => nodesById.get(id)?.type === 'CACHE');
  const cacheMultiplier = hasCache ? 1 - DEFAULT_CACHE_HIT_RATIO : 1;
  if (hasCache) {
    warnings.push(`캐시 적중률은 ${(DEFAULT_CACHE_HIT_RATIO * 100).toFixed(0)}%로 가정해 DB로 가는 트래픽을 줄였습니다.`);
  }

  // 웹 서버는 ASG로 묶인 것끼리 하나의 큐로 합친다(같은 ASG면 그 개수만큼 c가 커진다).
  // 9단계부터 ASG는 물리적 소속(parentId)이 아니라 Target Group과 같은 논리적 소속(logicalGroupId)이다 —
  // 실제 AWS의 ASG도 한 서브넷에 갇히지 않고 여러 AZ에 걸쳐 있는 게 정상이라 이렇게 바꿨다.
  const webServerGroups = new Map<string, GraphNode[]>();
  for (const id of relevantIds) {
    const node = nodesById.get(id);
    if (!node || node.type !== 'WEB_SERVER') continue;
    const logicalGroup = node.logicalGroupId ? nodesById.get(node.logicalGroupId) : undefined;
    const groupKey = logicalGroup?.type === 'AUTO_SCALING_GROUP' ? logicalGroup.id : node.id;
    const group = webServerGroups.get(groupKey) ?? [];
    group.push(node);
    webServerGroups.set(groupKey, group);
  }

  const nodeMetrics: PipelineNodeMetric[] = [];

  for (const [groupKey, members] of webServerGroups) {
    const representative = members[0];
    if (!representative) continue;

    let instanceCount = members.length;
    const isReduced = members.some((member) => options.capacityReducedNodeIds?.has(member.id));
    if (isReduced) {
      const ratio = options.capacityReductionRatio ?? 0.5;
      instanceCount = Math.max(1, Math.floor(instanceCount * (1 - ratio)));
    }

    const muRps = resolveMuRps(representative, presetsByCode, defaultPresetByType, warnings);
    const mmc = calculateMMc({ lambdaRps: expectedRps, muRps, instanceCount });
    nodeMetrics.push({
      nodeId: groupKey,
      nodeType: 'WEB_SERVER',
      lambdaRps: mmc.lambdaRps,
      muRps: mmc.muRps,
      instanceCount: mmc.instanceCount,
      rho: mmc.rho,
      isSaturated: mmc.isSaturated,
      avgLatencyMs: mmc.isSaturated ? null : mmc.avgLatencyMs,
      throughputRps: mmc.throughputRps,
    });
  }

  for (const id of relevantIds) {
    const node = nodesById.get(id);
    if (!node || (node.type !== 'CACHE' && node.type !== 'DB_PRIMARY' && node.type !== 'DB_REPLICA')) continue;

    const lambdaForNode = node.type === 'CACHE' ? expectedRps : expectedRps * cacheMultiplier;
    const muRps = resolveMuRps(node, presetsByCode, defaultPresetByType, warnings);
    const mmc = calculateMMc({ lambdaRps: lambdaForNode, muRps, instanceCount: 1 });
    nodeMetrics.push({
      nodeId: node.id,
      nodeType: node.type,
      lambdaRps: mmc.lambdaRps,
      muRps: mmc.muRps,
      instanceCount: 1,
      rho: mmc.rho,
      isSaturated: mmc.isSaturated,
      avgLatencyMs: mmc.isSaturated ? null : mmc.avgLatencyMs,
      throughputRps: mmc.throughputRps,
    });
  }

  const anySaturated = nodeMetrics.some((metric) => metric.isSaturated);
  const endToEndLatencyMs = anySaturated ? null : nodeMetrics.reduce((sum, metric) => sum + (metric.avgLatencyMs ?? 0), 0);
  const throughputRps = computeOverallThroughput(nodeMetrics, expectedRps);

  return { nodeMetrics, endToEndLatencyMs, throughputRps, warnings };
}

/**
 * 각 구간의 throughputRps를 그냥 min()으로 비교하면 틀린다 — 캐시가 흡수해서 DB로 가는 λ가
 * 자연스럽게 작아진 구간(예: λ=15)이, 포화되지도 않았는데 "병목"으로 잘못 뽑힌다. 실제로 병목은
 * "포화된 구간"이 있을 때만 존재하고, 그때의 한계치(c·μ)가 전체 처리량을 제한한다. 아무 구간도
 * 포화되지 않았다면 들어온 요청(expectedRps)이 그대로 다 처리된다고 본다.
 */
function computeOverallThroughput(nodeMetrics: PipelineNodeMetric[], expectedRps: number): number {
  const saturated = nodeMetrics.filter((metric) => metric.isSaturated);
  if (saturated.length === 0) return expectedRps;
  return Math.min(...saturated.map((metric) => metric.throughputRps));
}
