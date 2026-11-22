import { ENTRY_COMPONENT_TYPES, type ArchitectureGraph, type GraphNode } from '@nangman/shared-types';
import { buildNodesById, buildUndirectedAdjacency } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/**
 * SEC-002: 진입점(로드밸런서/API Gateway)에 WAF가 붙어 있지 않으면 경고. AWS Well-Architected
 * Framework Security Pillar SEC05-BP03 "Implement inspection-based protection" — "HTTP 기반
 * 프로토콜로 요청을 받는 구성요소는 WAF로 흔한 위협(인젝션 등)으로부터 보호해야 한다"는 원칙이고,
 * ALB/API Gateway/CloudFront 중 어디에 붙여도 똑같이 유효하다고 명시한다.
 *
 * 그래서 진입점 바로 옆에 WAF가 없어도, 그 앞에 CDN(CloudFront)이 있고 그 CDN 옆에 WAF가 있으면
 * 통과로 본다(CDN→LB처럼 흔한 구조에서 CDN 쪽에 WAF를 붙이는 것도 같은 보호 효과이기 때문).
 */
export function evaluateWafProtectionRule(graph: ArchitectureGraph): RuleEvaluation {
  const entryNodes = graph.nodes.filter((node) => ENTRY_COMPONENT_TYPES.includes(node.type));

  // 대상(진입점)이 하나도 없으면 "해당 없음"으로 표시한다.
  if (entryNodes.length === 0) {
    return { ruleCode: 'SEC-002', passed: true, applicable: false, detail: {} };
  }

  const nodesById = buildNodesById(graph);
  const adjacency = buildUndirectedAdjacency(graph);

  const hasWafNeighbor = (nodeId: string): boolean =>
    [...(adjacency.get(nodeId) ?? [])].some((neighborId) => nodesById.get(neighborId)?.type === 'WAF');

  const isProtected = (node: GraphNode): boolean => {
    if (hasWafNeighbor(node.id)) return true;
    const cdnNeighborIds = [...(adjacency.get(node.id) ?? [])].filter((id) => nodesById.get(id)?.type === 'CDN');
    return cdnNeighborIds.some((cdnId) => hasWafNeighbor(cdnId));
  };

  const violatingNodeIds = entryNodes.filter((node) => !isProtected(node)).map((node) => node.id);

  return {
    ruleCode: 'SEC-002',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
