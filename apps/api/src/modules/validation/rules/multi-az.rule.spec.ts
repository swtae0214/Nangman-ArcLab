import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateDbMultiAzRule } from './multi-az.rule.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges']): ArchitectureGraph {
  return { nodes, edges };
}

describe('evaluateDbMultiAzRule', () => {
  it('Redshift/OpenSearch는 Multi-AZ 그룹 밖에 있으면 위반으로 잡는다', () => {
    const result = evaluateDbMultiAzRule(
      graph(
        [
          { id: 'rs1', type: 'REDSHIFT', position: { x: 0, y: 0 }, data: { label: 'RS' } },
          { id: 'os1', type: 'OPENSEARCH', position: { x: 1, y: 0 }, data: { label: 'OS' } },
        ],
        [],
      ),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['rs1', 'os1']);
  });

  it('Redshift가 Multi-AZ 그룹 안에 있으면 통과한다', () => {
    const result = evaluateDbMultiAzRule(
      graph(
        [
          { id: 'maz1', type: 'MULTI_AZ_GROUP', position: { x: 0, y: 0 }, data: { label: 'Multi-AZ' } },
          { id: 'rs1', type: 'REDSHIFT', parentId: 'maz1', position: { x: 1, y: 0 }, data: { label: 'RS' } },
        ],
        [],
      ),
    );

    expect(result.passed).toBe(true);
  });

  /**
   * 12단계에서 한 번 Aurora를 이 규칙에 넣으려다 고친 부분 — Aurora/DocumentDB/DynamoDB는
   * 스토리지가 항상 자동으로 여러 AZ에 복제되는 서비스라, Multi-AZ 그룹 밖에 있어도 위반이
   * 아니다(해당 없음). 회귀 방지용으로 명시적으로 테스트해둔다.
   */
  it('Aurora/DocumentDB/DynamoDB는 Multi-AZ 그룹 밖에 있어도 해당 없음이다(영구적으로 자동 복제되는 서비스)', () => {
    const result = evaluateDbMultiAzRule(
      graph(
        [
          { id: 'aur1', type: 'AURORA', position: { x: 0, y: 0 }, data: { label: 'Aurora' } },
          { id: 'doc1', type: 'DOCUMENT_DB', position: { x: 1, y: 0 }, data: { label: 'DocDB' } },
          { id: 'ddb1', type: 'DYNAMODB', position: { x: 2, y: 0 }, data: { label: 'DDB' } },
        ],
        [],
      ),
    );

    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });

  it('대상 타입이 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateDbMultiAzRule(graph([], []));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
