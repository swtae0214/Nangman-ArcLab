import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateSpofRule } from './spof.rule.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges']): ArchitectureGraph {
  return { nodes, edges };
}

describe('evaluateSpofRule', () => {
  it('단일 웹서버가 LB-DB 경로의 유일한 연결점이면 SPOF로 잡는다', () => {
    const result = evaluateSpofRule(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'ws1', target: 'db1' },
        ],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['ws1']);
  });

  it('웹서버가 두 대이고 각각 독립된 경로로 DB에 닿으면 SPOF가 없다', () => {
    const result = evaluateSpofRule(
      graph(
        [
          { id: 'lb1', type: 'LOAD_BALANCER', position: { x: 0, y: 0 }, data: { label: 'LB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS1' } },
          { id: 'ws2', type: 'WEB_SERVER', position: { x: 1, y: 1 }, data: { label: 'WS2' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 2, y: 0 }, data: { label: 'DB' } },
        ],
        [
          { id: 'e1', source: 'lb1', target: 'ws1' },
          { id: 'e2', source: 'lb1', target: 'ws2' },
          { id: 'e3', source: 'ws1', target: 'db1' },
          { id: 'e4', source: 'ws2', target: 'db1' },
        ],
      ),
    );

    expect(result.passed).toBe(true);
    expect(result.detail.nodeIds).toBeUndefined();
  });

  it('로드밸런서나 DB가 하나도 없으면 "해당 없음"으로 본다', () => {
    const result = evaluateSpofRule(
      graph([{ id: 'ws1', type: 'WEB_SERVER', position: { x: 0, y: 0 }, data: { label: 'WS' } }], []),
    );

    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });

  it('12단계: API Gateway도 진입점으로, DynamoDB도 데이터 저장소로 SPOF 판정에 들어간다', () => {
    const result = evaluateSpofRule(
      graph(
        [
          { id: 'gw1', type: 'API_GATEWAY', position: { x: 0, y: 0 }, data: { label: 'GW' } },
          { id: 'fn1', type: 'LAMBDA', position: { x: 1, y: 0 }, data: { label: 'Fn' } },
          { id: 'ddb1', type: 'DYNAMODB', position: { x: 2, y: 0 }, data: { label: 'DDB' } },
        ],
        [
          { id: 'e1', source: 'gw1', target: 'fn1' },
          { id: 'e2', source: 'fn1', target: 'ddb1' },
        ],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['fn1']);
  });
});
