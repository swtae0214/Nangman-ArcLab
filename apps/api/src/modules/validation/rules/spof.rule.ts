import type { ArchitectureGraph } from '@nangman/shared-types';
import { buildUndirectedAdjacency, canReachAnyExcluding, findArticulationPoints } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/**
 * SPOF-001: 로드밸런서 → DB 사이에 단일 장애점이 있는가.
 * 그래프 전체의 절단점을 먼저 구하고, 그중 "그 절단점을 지웠을 때 실제로 어느 LB에서도
 * 어느 DB로도 못 가는" 것만 SPOF로 보고한다 — 검증과 무관한 위치의 절단점(예: 독립된
 * CDN 곁가지)까지 SPOF로 오탐하지 않기 위해서다.
 */
export function evaluateSpofRule(graph: ArchitectureGraph): RuleEvaluation {
  const adjacency = buildUndirectedAdjacency(graph);
  const nodeIds = graph.nodes.map((node) => node.id);
  const articulationPoints = findArticulationPoints(nodeIds, adjacency);

  const loadBalancerIds = graph.nodes.filter((node) => node.type === 'LOAD_BALANCER').map((node) => node.id);
  const databaseIds = new Set(
    graph.nodes.filter((node) => node.type === 'DB_PRIMARY' || node.type === 'DB_REPLICA').map((node) => node.id),
  );

  // 로드밸런서나 DB가 하나라도 없으면 "그 사이의 단일 장애점"을 따질 경로 자체가 없다 — "해당 없음"으로 표시한다.
  if (loadBalancerIds.length === 0 || databaseIds.size === 0) {
    return { ruleCode: 'SPOF-001', passed: true, applicable: false, detail: {} };
  }

  const spofNodeIds: string[] = [];
  for (const point of articulationPoints) {
    const stillReachable = loadBalancerIds.some((lbId) => canReachAnyExcluding(adjacency, lbId, databaseIds, point));
    if (!stillReachable) {
      spofNodeIds.push(point);
    }
  }

  return {
    ruleCode: 'SPOF-001',
    passed: spofNodeIds.length === 0,
    applicable: true,
    detail: spofNodeIds.length > 0 ? { nodeIds: spofNodeIds } : {},
  };
}
