import type { ComponentPresetCatalogItem, ComponentType } from "@nangman/shared-types";
import type { FlowNode } from "./types";
import { computeAlbCost, computeCdnCost, DEFAULT_ALB_REQUESTS_PER_CONNECTION, DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB } from "./usage-based-cost";

/** 5단계 큐잉 엔진이 M/M/c 계산 대상으로 삼는, 프리셋(인스턴스 크기)을 직접 고를 수 있는 타입. */
export const PRESET_SELECTABLE_TYPES: ComponentType[] = ["WEB_SERVER", "DB_PRIMARY", "DB_REPLICA", "CACHE"];

/** 실제로 AWS 요금이 붙는(=프리셋을 고를 수 있거나 앞으로 고를 수 있게 될) 컴포넌트 타입. */
export const COST_RELEVANT_TYPES: ComponentType[] = [...PRESET_SELECTABLE_TYPES, "LOAD_BALANCER", "CDN"];

/**
 * F5: monthlyCostUsd가 없을 때, 비용 탭이 "프리셋을 고르면 계산돼요" 그룹과 "가격 데이터가 아직
 * 없어요" 그룹을 나눠서 보여주기 위한 이유 코드. 타입을 하드코딩해서 나누지 않고 "왜 못 구했는지"로
 * 나누는 이유: CDN도 입구 노드에 평균 응답 크기만 채우면 계산되는 등, 타입만으로는 못 가른다.
 */
export type CostUnresolvedReason = "needs-preset" | "needs-input";

export interface NodeCostLine {
  nodeId: string;
  label: string;
  type: ComponentType;
  presetDisplayName?: string;
  /** 프리셋/사용량 계산 중 하나로든 값이 나왔으면 있다(완전 반영이든 일부만 반영이든). */
  monthlyCostUsd?: number;
  /** true면 monthlyCostUsd가 "일부만 반영된" 값이다(예: ALB 고정 요금만, LCU 미반영). */
  isPartial?: boolean;
  /** isPartial일 때 그 이유를 한 줄로 — 행에 그대로 표시한다. */
  partialNote?: string;
  /** monthlyCostUsd가 없을 때만 있다 — 비용 탭이 이걸로 그룹을 나눈다. */
  unresolvedReason?: CostUnresolvedReason;
  /** unresolvedReason이 있을 때, 그 이유를 한 줄로 — 행에 그대로 표시한다. */
  unresolvedNote?: string;
}

export interface ArchitectureCostSummary {
  lines: NodeCostLine[];
  totalMonthlyCostUsd: number;
  /** true면 totalMonthlyCostUsd가 "최소(하한값)"다 — 라인 중 하나라도 미반영이거나 일부만 반영됐을 때. */
  isLowerBound: boolean;
  /** monthlyCostUsd가 있는(완전 반영 + 일부 반영 포함) 라인 수 — "N/M 반영" 배지의 분자. 분모는 lines.length. */
  resolvedCount: number;
  /** 가격 데이터의 대표 기준일(ISO)·리전 — 비용 탭 하단 각주("가격 기준일 ...")에 쓴다. */
  pricingFetchedAt?: string;
  pricingRegion?: string;
  /**
   * F5: CDN/LOAD_BALANCER 비용이 쓰는 "전체 트래픽" 가정 — 입력의 단일 출처는 USER 노드라서,
   * 비용 탭은 이 값을 읽기 전용으로 보여주고 "사용자 노드에서 수정" 링크만 제공한다(규칙 1).
   */
  assumptionUserNodeId?: string;
  assumptionAvgRps?: number;
  assumptionAvgResponseSizeKb?: number;
  /** F7(A4): true면 위 응답 크기가 사용자가 직접 넣은 값이 아니라 기본값(2.6KB)이다. */
  assumptionAvgResponseSizeIsDefault?: boolean;
}

/** 프리셋 코드 -> 프리셋 조회를 노드별로 반복하지 않도록 미리 맵으로 만든다. */
function toPresetMap(presets: ComponentPresetCatalogItem[]): Map<string, ComponentPresetCatalogItem> {
  return new Map(presets.map((preset) => [preset.code, preset]));
}

interface CostOutcome {
  monthlyCostUsd?: number;
  isPartial?: boolean;
  partialNote?: string;
  unresolvedReason?: CostUnresolvedReason;
  unresolvedNote?: string;
}

/**
 * F4/F5: CDN/LOAD_BALANCER는 프리셋이 아니라 트래픽(RPS) 기반 사용량 과금이라 node.data의
 * cdnCacheHitRatioPercent/albConnectionReuse 등을 읽어 usage-based-cost.ts로 계산한다. CDN의
 * 평균 응답 크기는 USER(입구) 노드 하나에만 저장되는 전역 가정이라 여기서 같이 찾아서 넘긴다.
 */
function computeUsageBasedOutcome(node: FlowNode, nodes: FlowNode[], rpsByNodeId?: ReadonlyMap<string, number>): CostOutcome {
  const rps = rpsByNodeId?.get(node.id);
  if (rps === undefined) {
    return { unresolvedReason: "needs-input", unresolvedNote: "연결된 경로가 없어서 계산할 수 없어요" };
  }

  if (node.type === "CDN") {
    // F7(A4): 평균 응답 크기를 안 정했으면 기본값(2.6KB, 시안 기준)으로 계산한다 — 더는 입력을
    // 기다리며 "계산 불가"로 막지 않는다.
    const avgResponseSizeKb = nodes.find((candidate) => candidate.type === "USER")?.data.entryAvgResponseSizeKb ?? DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB;
    return { monthlyCostUsd: computeCdnCost({ rps, avgResponseSizeKb }).monthlyCostUsd };
  }

  if (node.type === "LOAD_BALANCER") {
    // F7(A4): 연결당 평균 요청 수를 안 정했으면 기본값(1000, Nginx 기준)으로 계산한다.
    const result = computeAlbCost({
      rps,
      connectionReuse: node.data.albConnectionReuse ?? true,
      requestsPerConnection: node.data.albRequestsPerConnection ?? DEFAULT_ALB_REQUESTS_PER_CONNECTION,
      acceptPartialCost: node.data.albAcceptPartialCost,
    });
    if (!result) {
      return { unresolvedReason: "needs-input", unresolvedNote: "연결당 평균 요청 수를 입력하면 계산돼요" };
    }
    return result.isPartial
      ? { monthlyCostUsd: result.monthlyCostUsd, isPartial: true, partialNote: "LCU 요금 미반영(고정 요금만)" }
      : { monthlyCostUsd: result.monthlyCostUsd };
  }

  return { unresolvedReason: "needs-input", unresolvedNote: "가격 데이터가 아직 없어요" };
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
  let resolvedCount = 0;
  let isLowerBound = false;

  for (const node of nodes) {
    if (!node.type || !COST_RELEVANT_TYPES.includes(node.type)) continue;

    let outcome: CostOutcome;
    let presetDisplayName: string | undefined;

    if (PRESET_SELECTABLE_TYPES.includes(node.type)) {
      if (!node.data.presetCode) {
        outcome = { unresolvedReason: "needs-preset", unresolvedNote: "인스턴스 종류를 고르면 계산돼요" };
      } else {
        const preset = presetsByCode.get(node.data.presetCode);
        presetDisplayName = preset?.displayName;
        outcome =
          preset?.monthlyCostUsd !== undefined
            ? // F4: 인스턴스 수를 지정했으면(기본값 1) 프리셋 단가에 그만큼 곱한다.
              { monthlyCostUsd: preset.monthlyCostUsd * (node.data.instanceCount ?? 1) }
            : { unresolvedReason: "needs-input", unresolvedNote: "이 프리셋은 가격 데이터가 아직 없어요" };
      }
    } else {
      outcome = computeUsageBasedOutcome(node, nodes, rpsByNodeId);
    }

    lines.push({
      nodeId: node.id,
      label: node.data.label,
      type: node.type,
      presetDisplayName,
      ...outcome,
    });

    if (outcome.monthlyCostUsd !== undefined) {
      resolvedCount += 1;
      totalMonthlyCostUsd += outcome.monthlyCostUsd;
      if (outcome.isPartial) isLowerBound = true;
    } else {
      isLowerBound = true;
    }
  }

  // 비용 탭 하단의 "가격 기준일" 각주용 — 프리셋들은 한 번에 같이 수집돼서 보통 전부 같은 날짜/리전이다.
  const pricingSample = presets.find((preset) => preset.pricingFetchedAt !== undefined);
  const userNode = nodes.find((node) => node.type === "USER");

  return {
    lines,
    totalMonthlyCostUsd: Math.round(totalMonthlyCostUsd * 100) / 100,
    isLowerBound,
    resolvedCount,
    pricingFetchedAt: pricingSample?.pricingFetchedAt,
    pricingRegion: pricingSample?.awsRegion,
    assumptionUserNodeId: userNode?.id,
    assumptionAvgRps: userNode?.data.entryAvgRps,
    assumptionAvgResponseSizeKb: userNode?.data.entryAvgResponseSizeKb ?? DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB,
    assumptionAvgResponseSizeIsDefault: userNode?.data.entryAvgResponseSizeKb === undefined,
  };
}
