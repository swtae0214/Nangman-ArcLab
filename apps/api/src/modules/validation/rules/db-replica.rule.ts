import type { ArchitectureGraph } from '@nangman/shared-types';
import type { RuleEvaluation } from './rule.types.js';

/**
 * DB-002: Primary만 있고 Replica가 없으면 읽기 부하 분산이 불가능하다는 정보성 제안.
 * 원래 설계는 "예상 RPS 초과 시"라는 조건을 넣으려 했지만, 요구사항 입력 폼(4~5주차)이
 * 아직 없어서 RPS 값 자체가 없다 — 지금은 조건 없이 "Replica 존재 여부"만 확인한다.
 */
export function evaluateDbReplicaRule(graph: ArchitectureGraph): RuleEvaluation {
  const primaryIds = graph.nodes.filter((node) => node.type === 'DB_PRIMARY').map((node) => node.id);
  const hasReplica = graph.nodes.some((node) => node.type === 'DB_REPLICA');
  const passed = primaryIds.length === 0 || hasReplica;

  return {
    ruleCode: 'DB-002',
    passed,
    detail: passed ? {} : { nodeIds: primaryIds },
  };
}
