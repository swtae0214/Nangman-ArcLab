import { OPT_IN_ENCRYPTION_DATA_TYPES, type ArchitectureGraph } from '@nangman/shared-types';
import { buildNodesById, buildUndirectedAdjacency } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/**
 * SEC-003: 데이터 저장소에 KMS(암호화 키) 노드가 연결되어 있지 않으면 경고. AWS Well-Architected
 * Framework Security Pillar SEC08-BP02 "Enforce encryption at rest".
 *
 * OPT_IN_ENCRYPTION_DATA_TYPES(RDS/OpenSearch/DocumentDB)만 대상이다 — 이 셋은 지금도 저장 시
 * 암호화를 사용자가 직접 켜야 한다(안 켜면 평문 저장이 가능하다). Aurora/DynamoDB/Redshift/S3는
 * AWS가 최근(2023~2026년) 전부 기본 암호화로 바꿔서 "KMS 연결 없음"이 "암호화 안 됨"을 뜻하지
 * 않는다 — DATA_COMPONENT_TYPES 전체가 아니라 이 좁은 부분집합만 체크하는 이유다.
 */
export function evaluateKmsEncryptionRule(graph: ArchitectureGraph): RuleEvaluation {
  const targetNodes = graph.nodes.filter((node) => OPT_IN_ENCRYPTION_DATA_TYPES.includes(node.type));

  // 대상(암호화가 선택사항인 데이터 저장소)이 하나도 없으면 "해당 없음"으로 표시한다.
  if (targetNodes.length === 0) {
    return { ruleCode: 'SEC-003', passed: true, applicable: false, detail: {} };
  }

  const nodesById = buildNodesById(graph);
  const adjacency = buildUndirectedAdjacency(graph);

  const hasKmsNeighbor = (nodeId: string): boolean =>
    [...(adjacency.get(nodeId) ?? [])].some((neighborId) => nodesById.get(neighborId)?.type === 'KMS');

  const violatingNodeIds = targetNodes.filter((node) => !hasKmsNeighbor(node.id)).map((node) => node.id);

  return {
    ruleCode: 'SEC-003',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
