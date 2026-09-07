import type { ArchitectureGraph, ComponentType } from '@nangman/shared-types';
import { buildNodesById, findAncestorTypes } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/** targetTypes에 속한 노드가 Multi-AZ 또는 Multi-Region 그룹 안에 있는지 확인하는 공용 규칙. */
function evaluateGroupMembershipRule(graph: ArchitectureGraph, targetTypes: ComponentType[], ruleCode: string): RuleEvaluation {
  const nodesById = buildNodesById(graph);
  const violatingNodeIds = graph.nodes
    .filter((node) => targetTypes.includes(node.type))
    .filter((node) => {
      const ancestorTypes = findAncestorTypes(node, nodesById);
      return !ancestorTypes.has('MULTI_AZ_GROUP') && !ancestorTypes.has('MULTI_REGION_GROUP');
    })
    .map((node) => node.id);

  return {
    ruleCode,
    passed: violatingNodeIds.length === 0,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}

/** MULTIAZ-001: DB(Primary/Replica)가 Multi-AZ(또는 Multi-Region) 그룹에 속해 있는가. */
export function evaluateDbMultiAzRule(graph: ArchitectureGraph): RuleEvaluation {
  return evaluateGroupMembershipRule(graph, ['DB_PRIMARY', 'DB_REPLICA'], 'MULTIAZ-001');
}

/** MULTIAZ-002: 캐시가 Multi-AZ(또는 Multi-Region) 그룹에 속해 있는가. */
export function evaluateCacheMultiAzRule(graph: ArchitectureGraph): RuleEvaluation {
  return evaluateGroupMembershipRule(graph, ['CACHE'], 'MULTIAZ-002');
}
