import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { findNodesUnderScope, parseAffectsRule, removeNodesByType } from './failure-scenario.util.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges']): ArchitectureGraph {
  return { nodes, edges };
}

describe('parseAffectsRule', () => {
  it('알려진 필드만 안전하게 꺼내고 나머지는 무시한다', () => {
    const rule = parseAffectsRule({ removeNodeTypes: ['DB_PRIMARY'], extra: 'ignored' });
    expect(rule.removeNodeTypes).toEqual(['DB_PRIMARY']);
  });

  it('형태가 다르면 빈 규칙으로 처리한다', () => {
    expect(parseAffectsRule(null)).toEqual({});
    expect(parseAffectsRule('오류')).toEqual({});
  });
});

describe('removeNodesByType', () => {
  it('지정된 타입의 노드와 그 노드가 걸린 엣지를 함께 제거한다', () => {
    const result = removeNodesByType(
      graph(
        [
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 0, y: 0 }, data: { label: 'WS' } },
          { id: 'db1', type: 'DB_PRIMARY', position: { x: 1, y: 0 }, data: { label: 'DB' } },
        ],
        [{ id: 'e1', source: 'ws1', target: 'db1' }],
      ),
      ['DB_PRIMARY'],
    );

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.id).toBe('ws1');
    expect(result.edges).toHaveLength(0);
  });
});

describe('findNodesUnderScope', () => {
  it('scope 그룹의 자손 노드 id를 찾아낸다', () => {
    const affected = findNodesUnderScope(
      graph(
        [
          { id: 'az1', type: 'MULTI_AZ_GROUP', position: { x: 0, y: 0 }, data: { label: 'AZ' } },
          { id: 'db1', type: 'DB_PRIMARY', parentId: 'az1', position: { x: 0, y: 0 }, data: { label: 'DB' } },
          { id: 'ws1', type: 'WEB_SERVER', position: { x: 1, y: 0 }, data: { label: 'WS' } },
        ],
        [],
      ),
      ['MULTI_AZ_GROUP'],
    );

    expect(affected.has('db1')).toBe(true);
    expect(affected.has('ws1')).toBe(false);
  });
});
