import type { ArchitectureGraph, ComponentType } from '@nangman/shared-types';
import type { RuleEvaluation } from './rule.types.js';

/**
 * DB-002: 1차 DB(Primary/Aurora/DocumentDB)만 있고 읽기 확장용 복제본이 없으면 읽기 트래픽을
 * 분산할 수 없다는 정보성 제안. 원래 설계는 "예상 RPS 초과 시"라는 조건을 넣으려 했지만,
 * 요구사항 입력 폼(4~5주차)이 아직 없어서 RPS 값 자체가 없다 — 지금은 조건 없이 "복제본
 * 존재 여부"만 확인한다.
 *
 * Aurora/DocumentDB를 넣은 이유: 둘 다 RDS처럼 "Aurora Replica"/"복제 인스턴스"를 최대 15개까지
 * 만들 수 있고, AWS가 이를 읽기 확장 용도로 명시한다 — RDS Primary/Replica와 같은 질문이
 * 성립한다. DynamoDB(Global Tables는 리전 간 복제용, 읽기 확장이 목적이 아님)와 Redshift
 * (Concurrency Scaling은 자동 임시 용량이지 사용자가 만드는 복제본이 아님)는 같은 질문이
 * 성립하지 않아서 뺐다 — 영구적인 제외다.
 */
const PRIMARY_REPLICA_PAIRS: { primaryType: ComponentType; replicaType: ComponentType }[] = [
  { primaryType: 'DB_PRIMARY', replicaType: 'DB_REPLICA' },
  { primaryType: 'AURORA', replicaType: 'AURORA_REPLICA' },
  { primaryType: 'DOCUMENT_DB', replicaType: 'DOCUMENT_DB_REPLICA' },
];

export function evaluateDbReplicaRule(graph: ArchitectureGraph): RuleEvaluation {
  const presentTypes = new Set(graph.nodes.map((node) => node.type));

  const applicablePairs = PRIMARY_REPLICA_PAIRS.filter((pair) => presentTypes.has(pair.primaryType));
  // 대상 1차 DB 타입(DB_PRIMARY/AURORA/DOCUMENT_DB)이 하나도 없으면 "해당 없음"으로 표시한다.
  if (applicablePairs.length === 0) {
    return { ruleCode: 'DB-002', passed: true, applicable: false, detail: {} };
  }

  const violatingNodeIds = applicablePairs
    .filter((pair) => !presentTypes.has(pair.replicaType))
    .flatMap((pair) => graph.nodes.filter((node) => node.type === pair.primaryType).map((node) => node.id));

  return {
    ruleCode: 'DB-002',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
