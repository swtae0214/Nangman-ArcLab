import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateDbReplicaRule } from './db-replica.rule.js';

function graph(nodes: ArchitectureGraph['nodes']): ArchitectureGraph {
  return { nodes, edges: [] };
}

describe('evaluateDbReplicaRule', () => {
  it('DB Primary만 있고 Replica가 없으면 위반으로 잡는다', () => {
    const result = evaluateDbReplicaRule(
      graph([{ id: 'db1', type: 'DB_PRIMARY', position: { x: 0, y: 0 }, data: { label: 'DB' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['db1']);
  });

  it('DB Primary + Replica가 있으면 통과한다', () => {
    const result = evaluateDbReplicaRule(
      graph([
        { id: 'db1', type: 'DB_PRIMARY', position: { x: 0, y: 0 }, data: { label: 'DB' } },
        { id: 'rep1', type: 'DB_REPLICA', position: { x: 1, y: 0 }, data: { label: 'Replica' } },
      ]),
    );

    expect(result.passed).toBe(true);
  });

  /** 13단계: Aurora/DocumentDB는 RDS처럼 읽기 확장용 복제 인스턴스를 지원해서 DB-002에 추가했다. */
  it('Aurora만 있고 Aurora Replica가 없으면 위반으로 잡는다', () => {
    const result = evaluateDbReplicaRule(
      graph([{ id: 'aur1', type: 'AURORA', position: { x: 0, y: 0 }, data: { label: 'Aurora' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['aur1']);
  });

  it('Aurora + Aurora Replica가 있으면 통과한다', () => {
    const result = evaluateDbReplicaRule(
      graph([
        { id: 'aur1', type: 'AURORA', position: { x: 0, y: 0 }, data: { label: 'Aurora' } },
        { id: 'aur-rep1', type: 'AURORA_REPLICA', position: { x: 1, y: 0 }, data: { label: 'Aurora Replica' } },
      ]),
    );

    expect(result.passed).toBe(true);
  });

  it('DocumentDB만 있고 DocumentDB Replica가 없으면 위반으로 잡는다', () => {
    const result = evaluateDbReplicaRule(
      graph([{ id: 'doc1', type: 'DOCUMENT_DB', position: { x: 0, y: 0 }, data: { label: 'DocDB' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['doc1']);
  });

  /**
   * 13단계: DynamoDB는 읽기 확장을 파티셔닝으로 자동 처리하고(Global Tables는 리전 간 복제용),
   * Redshift는 Concurrency Scaling(자동 임시 용량)을 쓴다 — 둘 다 "복제본을 만들었는지" 자체를
   * 물을 수 없는 서비스라 DB-002 대상이 아니다(영구적 제외). 회귀 방지용으로 고정해둔다.
   */
  it('DynamoDB/Redshift는 복제본이 없어도 해당 없음이다(자동 확장 메커니즘이라 복제본 개념이 없음)', () => {
    const result = evaluateDbReplicaRule(
      graph([
        { id: 'ddb1', type: 'DYNAMODB', position: { x: 0, y: 0 }, data: { label: 'DDB' } },
        { id: 'rs1', type: 'REDSHIFT', position: { x: 1, y: 0 }, data: { label: 'RS' } },
      ]),
    );

    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });

  it('여러 종류의 1차 DB가 섞여 있으면 복제본 없는 것만 따로 잡는다', () => {
    const result = evaluateDbReplicaRule(
      graph([
        { id: 'db1', type: 'DB_PRIMARY', position: { x: 0, y: 0 }, data: { label: 'DB' } },
        { id: 'rep1', type: 'DB_REPLICA', position: { x: 1, y: 0 }, data: { label: 'Replica' } },
        { id: 'aur1', type: 'AURORA', position: { x: 2, y: 0 }, data: { label: 'Aurora' } },
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['aur1']);
  });

  it('대상 타입이 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateDbReplicaRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
