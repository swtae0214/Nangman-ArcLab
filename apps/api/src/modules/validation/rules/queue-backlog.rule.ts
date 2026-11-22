import { computeNodeRps, type ArchitectureGraph } from '@nangman/shared-types';
import type { RuleEvaluation } from './rule.types.js';

/**
 * QUEUE-001: 유입 메시지(레코드) 속도가 컨슈머 처리 능력을 넘으면 적체 위험을 경고한다.
 * SQS(풀 기반 큐)와 Kinesis Data Streams(샤드 기반 스트림)만 대상이다 — 둘 다 "컨슈머가
 * 못 따라가면 쌓인다"는 실제 AWS 운영 지표(SQS의 ApproximateNumberOfMessagesVisible,
 * Kinesis의 GetRecords.IteratorAgeMilliseconds)가 있는 서비스다.
 *
 * SNS/EventBridge/Kinesis Data Firehose는 일부러 뺐다 — 셋 다 밀어주기(push) 방식 전달이거나
 * (SNS/EventBridge, 실패하면 재시도 후 DLQ로 가지 쌓여서 지연되는 게 아님) 완전관리형 자동
 * 버퍼링(Firehose, 사용자가 정하는 "컨슈머 처리 능력" 자체가 없음)이라 같은 질문이 성립하지
 * 않는다 — 영구적인 제외다.
 */
const BACKLOG_PRONE_TYPES = new Set(['SQS', 'KINESIS_DATA_STREAMS']);

export function evaluateQueueBacklogRule(graph: ArchitectureGraph): RuleEvaluation {
  const targetNodes = graph.nodes.filter((node) => BACKLOG_PRONE_TYPES.has(node.type));

  // 대상 타입이 하나도 없으면 적체 위험을 따질 대상 자체가 없다 — "해당 없음"으로 표시한다.
  if (targetNodes.length === 0) {
    return { ruleCode: 'QUEUE-001', passed: true, applicable: false, detail: {} };
  }

  const { rpsByNodeId } = computeNodeRps(graph);

  const violatingNodeIds = targetNodes
    .filter((node) => {
      // 컨슈머 처리 능력을 아직 안 정했으면 비교할 기준이 없다 — "쌓일 것"이라고 추정하지 않고
      // 판정에서 뺀다(모르는 걸 위반으로 단정하지 않는다).
      const capacity = node.data.queueConsumerThroughputRps;
      if (capacity === undefined) return false;
      const incomingRps = rpsByNodeId.get(node.id) ?? 0;
      return incomingRps > capacity;
    })
    .map((node) => node.id);

  return {
    ruleCode: 'QUEUE-001',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
