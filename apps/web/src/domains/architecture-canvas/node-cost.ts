import type { ComponentPresetCatalogItem, ComponentType } from "@nangman/shared-types";
import type { FlowNode } from "./types";
import { computeAlbCost, computeCdnCost } from "./usage-based-cost";

/** 실제로 AWS 요금이 붙는(=프리셋을 고를 수 있거나 앞으로 고를 수 있게 될) 컴포넌트 타입. */
export const COST_RELEVANT_TYPES: ComponentType[] = ["WEB_SERVER", "DB_PRIMARY", "DB_REPLICA", "CACHE", "LOAD_BALANCER", "CDN"];

export interface NodeCostLine {
  nodeId: string;
  label: string;
  type: ComponentType;
  presetDisplayName?: string;
  /** 프리셋이 지정됐고 그 프리셋에 가격 데이터가 있을 때만 값이 있다. */
  monthlyCostUsd?: number;
}

export interface ArchitectureCostSummary {
  lines: NodeCostLine[];
  totalMonthlyCostUsd: number;
  /** 가격을 아직 알 수 없는 노드 수 (프리셋 미지정 또는 LOAD_BALANCER/CDN처럼 프리셋 자체가 없는 타입). */
  unresolvedCount: number;
}

/** 프리셋 코드 -> 프리셋 조회를 노드별로 반복하지 않도록 미리 맵으로 만든다. */
function toPresetMap(presets: ComponentPresetCatalogItem[]): Map<string, ComponentPresetCatalogItem> {
  return new Map(presets.map((preset) => [preset.code, preset]));
}

/** 노드 하나의 월 예상 비용 — 프리셋이 없거나 그 프리셋에 가격 데이터가 아직 없으면 undefined. */
export function getNodeMonthlyCostUsd(node: FlowNode, presetsByCode: Map<string, ComponentPresetCatalogItem>): number | undefined {
  if (!node.data.presetCode) return undefined;
  return presetsByCode.get(node.data.presetCode)?.monthlyCostUsd;
}

/**
 * F4: CDN/LOAD_BALANCER는 프리셋이 아니라 트래픽(RPS) 기반 사용량 과금이라 node.data의
 * cdnCacheHitRatioPercent/albConnectionReuse 등을 읽어 usage-based-cost.ts로 계산한다. CDN의
 * 평균 응답 크기는 USER(입구) 노드 하나에만 저장되는 전역 가정이라 여기서 같이 찾아서 넘긴다.
 */
function getUsageBasedMonthlyCostUsd(node: FlowNode, nodes: FlowNode[], rpsByNodeId?: ReadonlyMap<string, number>): number | undefined {
  const rps = rpsByNodeId?.get(node.id);
  if (rps === undefined) return undefined;

  if (node.type === "CDN") {
    const avgResponseSizeKb = nodes.find((candidate) => candidate.type === "USER")?.data.entryAvgResponseSizeKb;
    if (avgResponseSizeKb === undefined) return undefined;
    return computeCdnCost({ rps, avgResponseSizeKb }).monthlyCostUsd;
  }

  if (node.type === "LOAD_BALANCER") {
    const result = computeAlbCost({
      rps,
      connectionReuse: node.data.albConnectionReuse ?? true,
      requestsPerConnection: node.data.albRequestsPerConnection,
    });
    return result?.monthlyCostUsd;
  }

  return undefined;
}

/** 캔버스 전체의 비용 탭/헤더 배지가 공통으로 쓰는 집계 — 과금 대상 타입만 모아 합계와 라인별 상세를 만든다. */
export function summarizeArchitectureCost(
  nodes: FlowNode[],
  presets: ComponentPresetCatalogItem[],
  rpsByNodeId?: ReadonlyMap<string, number>,
): ArchitectureCostSummary {
  const presetsByCode = toPresetMap(presets);
  const lines: NodeCostLine[] = [];
  let totalMonthlyCostUsd = 0;
  let unresolvedCount = 0;

  for (const node of nodes) {
    if (!node.type || !COST_RELEVANT_TYPES.includes(node.type)) continue;
    const preset = node.data.presetCode ? presetsByCode.get(node.data.presetCode) : undefined;
    const monthlyCostUsd = preset?.monthlyCostUsd ?? getUsageBasedMonthlyCostUsd(node, nodes, rpsByNodeId);
    lines.push({
      nodeId: node.id,
      label: node.data.label,
      type: node.type,
      presetDisplayName: preset?.displayName,
      monthlyCostUsd,
    });
    if (monthlyCostUsd === undefined) {
      unresolvedCount += 1;
    } else {
      totalMonthlyCostUsd += monthlyCostUsd;
    }
  }

  return { lines, totalMonthlyCostUsd: Math.round(totalMonthlyCostUsd * 100) / 100, unresolvedCount };
}
