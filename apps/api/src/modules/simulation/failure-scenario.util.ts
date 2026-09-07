import type { ArchitectureGraph, ComponentType } from '@nangman/shared-types';
import { buildNodesById, findAncestorTypes } from '../validation/graph.util.js';

/**
 * failure_scenarios.affects_rule에 담기는 내용. 두 가지 방식만 지원한다:
 * - removeNodeTypes: 해당 타입의 노드를 그래프에서 통째로 지운다 (예: DB Primary 장애).
 * - capacityReductionRatio + scope: scope 그룹(들) 아래에 있는 노드의 인스턴스 수를 비율만큼 줄인다
 *   (예: "AZ 하나 다운" → Multi-AZ/ASG 그룹 아래 인스턴스 절반 상실).
 *
 * 우리는 노드가 "어느 물리적 AZ에 있는지"까지는 모델링하지 않으므로(Multi-AZ 그룹은 "여러 AZ에
 * 걸쳐 있다"는 사실만 표현), "AZ 하나 다운"을 정확히 절반이 아니라 근사치로 다룬다는 점을 밝혀둔다.
 */
export interface FailureAffectsRule {
  removeNodeTypes?: ComponentType[];
  capacityReductionRatio?: number;
  scope?: ComponentType[];
}

export function parseAffectsRule(value: unknown): FailureAffectsRule {
  if (typeof value !== 'object' || value === null) return {};
  const rule = value as Record<string, unknown>;
  return {
    removeNodeTypes: Array.isArray(rule.removeNodeTypes) ? (rule.removeNodeTypes as ComponentType[]) : undefined,
    capacityReductionRatio: typeof rule.capacityReductionRatio === 'number' ? rule.capacityReductionRatio : undefined,
    scope: Array.isArray(rule.scope) ? (rule.scope as ComponentType[]) : undefined,
  };
}

/** removeNodeTypes에 해당하는 노드(와 그 노드가 걸린 엣지)를 그래프에서 제거한다. */
export function removeNodesByType(graph: ArchitectureGraph, removeNodeTypes: ComponentType[] | undefined): ArchitectureGraph {
  if (!removeNodeTypes || removeNodeTypes.length === 0) return graph;
  const removeTypes = new Set(removeNodeTypes);
  const remainingIds = new Set(graph.nodes.filter((node) => !removeTypes.has(node.type)).map((node) => node.id));

  return {
    nodes: graph.nodes.filter((node) => remainingIds.has(node.id)),
    edges: graph.edges.filter((edge) => remainingIds.has(edge.source) && remainingIds.has(edge.target)),
  };
}

/** scope 그룹들의 자손인 노드 id를 전부 찾는다 (용량 축소 대상 판별용). */
export function findNodesUnderScope(graph: ArchitectureGraph, scope: ComponentType[] | undefined): Set<string> {
  if (!scope || scope.length === 0) return new Set();
  const nodesById = buildNodesById(graph);
  const scopeSet = new Set<string>(scope);
  const affected = new Set<string>();

  for (const node of graph.nodes) {
    const ancestorTypes = findAncestorTypes(node, nodesById);
    for (const ancestorType of ancestorTypes) {
      if (scopeSet.has(ancestorType)) {
        affected.add(node.id);
        break;
      }
    }
  }

  return affected;
}
