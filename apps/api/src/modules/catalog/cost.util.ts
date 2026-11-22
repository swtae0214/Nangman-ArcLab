import type { ArchitectureGraph, ComponentPresetCatalogItem } from '@nangman/shared-types';
import {
  computeAlbCost,
  computeCdnCost,
  computeNodeRps,
  DEFAULT_ALB_REQUESTS_PER_CONNECTION,
  DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB,
} from '@nangman/shared-types';

/** 과금 대상(프리셋을 고를 수 있거나 앞으로 고를 수 있게 될) 타입 — apps/web의 node-cost.ts와 같은 목록. */
export const COST_RELEVANT_TYPES = new Set(['WEB_SERVER', 'DB_PRIMARY', 'DB_REPLICA', 'CACHE', 'LOAD_BALANCER', 'CDN']);
const PRESET_SELECTABLE_TYPES = new Set(['WEB_SERVER', 'DB_PRIMARY', 'DB_REPLICA', 'CACHE']);

/**
 * 그래프(현재 그래프, 과거 스냅샷, 또는 "빼고 시험해 보기"의 가상 그래프)를 기준으로 월 예상
 * 비용을 어림잡는다. 프리셋이 없거나 그 프리셋에 가격 데이터가 아직 없는 노드(WEB_SERVER 등)와,
 * 연결된 트래픽 경로가 없어 RPS를 구할 수 없는 CDN/LOAD_BALANCER는 합계에서 제외한다 —
 * apps/web의 node-cost.ts(summarizeArchitectureCost)와 같은 계산(프리셋 단가 + CDN/ALB 사용량
 * 기반 요금)을 그대로 따라야, Cost 탭 숫자와 시뮬레이션(F2)/What-if 미리보기(F3) 숫자가 어긋나지
 * 않는다. simulation.service.ts(F2)와 validation.controller.ts(F3)가 함께 쓴다.
 */
export function estimateMonthlyCostUsd(graph: ArchitectureGraph, presets: ComponentPresetCatalogItem[]): number {
  const presetsByCode = new Map(presets.map((preset) => [preset.code, preset]));
  const { rpsByNodeId } = computeNodeRps(graph);
  const userNode = graph.nodes.find((node) => node.type === 'USER');
  const avgResponseSizeKb = userNode?.data.entryAvgResponseSizeKb ?? DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB;

  let total = 0;
  for (const node of graph.nodes) {
    if (!COST_RELEVANT_TYPES.has(node.type)) continue;

    if (PRESET_SELECTABLE_TYPES.has(node.type)) {
      const presetMonthlyCostUsd = node.data.presetCode ? presetsByCode.get(node.data.presetCode)?.monthlyCostUsd : undefined;
      // F4: 인스턴스 수를 지정했으면(기본값 1) 프리셋 단가에 그만큼 곱한다.
      if (presetMonthlyCostUsd !== undefined) total += presetMonthlyCostUsd * (node.data.instanceCount ?? 1);
      continue;
    }

    const rps = rpsByNodeId.get(node.id);
    if (rps === undefined) continue;

    if (node.type === 'CDN') {
      total += computeCdnCost({ rps, avgResponseSizeKb }).monthlyCostUsd;
      continue;
    }

    if (node.type === 'LOAD_BALANCER') {
      const albResult = computeAlbCost({
        rps,
        connectionReuse: node.data.albConnectionReuse ?? true,
        requestsPerConnection: node.data.albRequestsPerConnection ?? DEFAULT_ALB_REQUESTS_PER_CONNECTION,
        acceptPartialCost: node.data.albAcceptPartialCost,
      });
      if (albResult) total += albResult.monthlyCostUsd;
    }
  }
  return Math.round(total * 100) / 100;
}
