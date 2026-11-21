import type { ArchitectureGraph, ComponentPresetCatalogItem } from '@nangman/shared-types';

/** 과금 대상(프리셋을 고를 수 있거나 앞으로 고를 수 있게 될) 타입 — apps/web의 node-cost.ts와 같은 목록. */
export const COST_RELEVANT_TYPES = new Set(['WEB_SERVER', 'DB_PRIMARY', 'DB_REPLICA', 'CACHE', 'LOAD_BALANCER', 'CDN']);

/**
 * 그래프(현재 그래프, 과거 스냅샷, 또는 "빼고 시험해 보기"의 가상 그래프)를 기준으로 월 예상
 * 비용을 어림잡는다. 프리셋이 없거나 그 프리셋에 가격 데이터가 아직 없는 노드(LB/CDN 등)는
 * 합계에서 제외한다. simulation.service.ts(F2)와 validation.controller.ts(F3)가 함께 쓴다.
 */
export function estimateMonthlyCostUsd(graph: ArchitectureGraph, presets: ComponentPresetCatalogItem[]): number {
  const presetsByCode = new Map(presets.map((preset) => [preset.code, preset]));
  let total = 0;
  for (const node of graph.nodes) {
    if (!COST_RELEVANT_TYPES.has(node.type)) continue;
    const presetMonthlyCostUsd = node.data.presetCode ? presetsByCode.get(node.data.presetCode)?.monthlyCostUsd : undefined;
    // F4: 인스턴스 수를 지정했으면(기본값 1) 프리셋 단가에 그만큼 곱한다.
    if (presetMonthlyCostUsd !== undefined) total += presetMonthlyCostUsd * (node.data.instanceCount ?? 1);
  }
  return Math.round(total * 100) / 100;
}
