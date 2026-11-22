import { DATA_COMPONENT_TYPES, type ArchitectureGraph } from '@nangman/shared-types';
import { buildNodesById, findAncestorTypes } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/**
 * SEC-001: 데이터 저장소(DB_PRIMARY/Aurora/DocumentDB/Redshift/OpenSearch/DynamoDB 등)가 Public
 * Subnet 안에 직접 있으면 위반. AWS Well-Architected Framework Security Pillar SEC05-BP01
 * "Create network layers" — "데이터베이스는 로드밸런서에서 직접 접근 가능해서는 안 되고, 비즈니스
 * 로직/웹 서버만 직접 접근할 수 있어야 한다"는 원칙으로, 데이터 저장소는 private subnet에 둔다.
 *
 * Private Subnet에 있거나 서브넷 자체를 안 썼으면 통과로 본다 — 서브넷을 안 그렸다는 건 실수가
 * 아니라 단순히 그렇게 그린 것뿐이라, 명확하게 Public Subnet 안에 넣은 경우만 실제 위반으로 잡는다.
 */
export function evaluatePublicSubnetExposureRule(graph: ArchitectureGraph): RuleEvaluation {
  const dataNodes = graph.nodes.filter((node) => DATA_COMPONENT_TYPES.includes(node.type));

  // 대상(데이터 저장소)이 하나도 없으면 "해당 없음"으로 표시한다.
  if (dataNodes.length === 0) {
    return { ruleCode: 'SEC-001', passed: true, applicable: false, detail: {} };
  }

  const nodesById = buildNodesById(graph);
  const violatingNodeIds = dataNodes
    .filter((node) => findAncestorTypes(node, nodesById).has('PUBLIC_SUBNET'))
    .map((node) => node.id);

  return {
    ruleCode: 'SEC-001',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
