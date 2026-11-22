import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluatePublicSubnetExposureRule } from './public-subnet-exposure.rule.js';

function graph(nodes: ArchitectureGraph['nodes']): ArchitectureGraph {
  return { nodes, edges: [] };
}

describe('evaluatePublicSubnetExposureRule', () => {
  it('DB가 Public Subnet 안에 있으면 위반으로 잡는다', () => {
    const result = evaluatePublicSubnetExposureRule(
      graph([
        { id: 'pub1', type: 'PUBLIC_SUBNET', position: { x: 0, y: 0 }, data: { label: 'Public' } },
        { id: 'db1', type: 'DB_PRIMARY', parentId: 'pub1', position: { x: 1, y: 0 }, data: { label: 'DB' } },
      ]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['db1']);
  });

  it('DB가 Private Subnet 안에 있으면 통과한다', () => {
    const result = evaluatePublicSubnetExposureRule(
      graph([
        { id: 'priv1', type: 'PRIVATE_SUBNET', position: { x: 0, y: 0 }, data: { label: 'Private' } },
        { id: 'db1', type: 'DB_PRIMARY', parentId: 'priv1', position: { x: 1, y: 0 }, data: { label: 'DB' } },
      ]),
    );

    expect(result.passed).toBe(true);
  });

  it('DB가 서브넷 자체를 안 썼으면(최상위) 실수로 단정하지 않고 통과로 본다', () => {
    const result = evaluatePublicSubnetExposureRule(
      graph([{ id: 'db1', type: 'DB_PRIMARY', position: { x: 0, y: 0 }, data: { label: 'DB' } }]),
    );

    expect(result.passed).toBe(true);
  });

  it('DynamoDB가 Public Subnet 안에 있어도 잡는다(DATA_COMPONENT_TYPES 전체 대상)', () => {
    const result = evaluatePublicSubnetExposureRule(
      graph([
        { id: 'pub1', type: 'PUBLIC_SUBNET', position: { x: 0, y: 0 }, data: { label: 'Public' } },
        { id: 'ddb1', type: 'DYNAMODB', parentId: 'pub1', position: { x: 1, y: 0 }, data: { label: 'DDB' } },
      ]),
    );

    expect(result.passed).toBe(false);
  });

  it('대상 타입이 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluatePublicSubnetExposureRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
