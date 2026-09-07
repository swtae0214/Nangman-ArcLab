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

  it('로드밸런서나 DB가 하나도 없으면 검사 대상이 없어 통과로 본다', () => {
    const result = evaluateSpofRule(
      graph([{ id: 'ws1', type: 'WEB_SERVER', position: { x: 0, y: 0 }, data: { label: 'WS' } }], []),
    );

    expect(result.passed).toBe(true);
  });
});
