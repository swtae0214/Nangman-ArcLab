import { MULTI_AZ_TOGGLE_DATA_TYPES, type ArchitectureGraph, type ComponentType } from '@nangman/shared-types';
import { buildNodesById, findAncestorTypes } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/** targetTypes에 속한 노드가 Multi-AZ 또는 Multi-Region 그룹 안에 있는지 확인하는 공용 규칙. */
function evaluateGroupMembershipRule(graph: ArchitectureGraph, targetTypes: ComponentType[], ruleCode: string): RuleEvaluation {
  const targetNodes = graph.nodes.filter((node) => targetTypes.includes(node.type));
  // targetTypes에 해당하는 컴포넌트가 캔버스에 하나도 없으면, Multi-AZ를 "통과"한 게 아니라
  // 애초에 검사할 대상이 없는 것이다 — "해당 없음"으로 표시한다.
  if (targetNodes.length === 0) {
    return { ruleCode, passed: true, applicable: false, detail: {} };
  }

  const nodesById = buildNodesById(graph);
  const violatingNodeIds = targetNodes
    .filter((node) => {
      const ancestorTypes = findAncestorTypes(node, nodesById);
      return !ancestorTypes.has('MULTI_AZ_GROUP') && !ancestorTypes.has('MULTI_REGION_GROUP');
    })
    .map((node) => node.id);

  return {
    ruleCode,
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}

/**
 * MULTIAZ-001: DB(Primary/Replica), Redshift, OpenSearch가 Multi-AZ(또는 Multi-Region) 그룹에
 * 속해 있는가. Aurora/DocumentDB/DynamoDB는 일부러 안 넣는다 — 스토리지가 항상 자동으로 여러
 * AZ에 복제되는 서비스라 "그룹에 넣었는지" 자체를 물어볼 수 없다(사용자가 켜고 끄는 설정이 아님).
 */
export function evaluateDbMultiAzRule(graph: ArchitectureGraph): RuleEvaluation {
  return evaluateGroupMembershipRule(graph, MULTI_AZ_TOGGLE_DATA_TYPES, 'MULTIAZ-001');
}

/** MULTIAZ-002: 캐시가 Multi-AZ(또는 Multi-Region) 그룹에 속해 있는가. */
export function evaluateCacheMultiAzRule(graph: ArchitectureGraph): RuleEvaluation {
  return evaluateGroupMembershipRule(graph, ['CACHE'], 'MULTIAZ-002');
}
