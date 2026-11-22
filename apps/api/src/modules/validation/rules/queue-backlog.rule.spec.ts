import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateQueueBacklogRule } from './queue-backlog.rule.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges'] = []): ArchitectureGraph {
  return { nodes, edges };
}

describe('evaluateQueueBacklogRule', () => {
  it('유입 RPS가 컨슈머 처리 능력을 넘으면 적체 위험으로 잡는다', () => {
    const result = evaluateQueueBacklogRule(
      graph(
        [
          { id: 'user1', type: 'USER', position: { x: 0, y: 0 }, data: { label: 'User', entryAvgRps: 100 } },
          { id: 'sqs1', type: 'SQS', position: { x: 1, y: 0 }, data: { label: 'Queue', queueConsumerThroughputRps: 50 } },
        ],
        [{ id: 'e1', source: 'user1', target: 'sqs1' }],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['sqs1']);
  });

  it('유입 RPS가 컨슈머 처리 능력 이하면 통과한다', () => {
    const result = evaluateQueueBacklogRule(
      graph(
        [
          { id: 'user1', type: 'USER', position: { x: 0, y: 0 }, data: { label: 'User', entryAvgRps: 30 } },
          { id: 'kds1', type: 'KINESIS_DATA_STREAMS', position: { x: 1, y: 0 }, data: { label: 'Stream', queueConsumerThroughputRps: 50 } },
        ],
        [{ id: 'e1', source: 'user1', target: 'kds1' }],
      ),
    );

    expect(result.passed).toBe(true);
  });

  it('컨슈머 처리 능력을 안 정했으면 유입이 많아도 위반으로 단정하지 않는다', () => {
    const result = evaluateQueueBacklogRule(
      graph(
        [
          { id: 'user1', type: 'USER', position: { x: 0, y: 0 }, data: { label: 'User', entryAvgRps: 1000 } },
          { id: 'sqs1', type: 'SQS', position: { x: 1, y: 0 }, data: { label: 'Queue' } },
        ],
        [{ id: 'e1', source: 'user1', target: 'sqs1' }],
      ),
    );

    expect(result.passed).toBe(true);
  });

  /**
   * 13단계: SNS/EventBridge(push 방식, 실패하면 재시도 후 DLQ로 가지 쌓이지 않음)와 Kinesis Data
   * Firehose(완전관리형 자동 버퍼링, 사용자가 정하는 컨슈머 처리 능력 자체가 없음)는 영구적으로
   * 대상이 아니다 — 회귀 방지용으로 고정해둔다.
   */
  it('SNS/EventBridge/Kinesis Data Firehose는 항상 해당 없음이다(적체 개념이 없는 서비스)', () => {
    const result = evaluateQueueBacklogRule(
      graph([
        { id: 'sns1', type: 'SNS', position: { x: 0, y: 0 }, data: { label: 'SNS' } },
        { id: 'eb1', type: 'EVENTBRIDGE', position: { x: 1, y: 0 }, data: { label: 'EB' } },
        { id: 'fh1', type: 'KINESIS_DATA_FIREHOSE', position: { x: 2, y: 0 }, data: { label: 'Firehose' } },
      ]),
    );

    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });

  it('대상 타입이 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateQueueBacklogRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
