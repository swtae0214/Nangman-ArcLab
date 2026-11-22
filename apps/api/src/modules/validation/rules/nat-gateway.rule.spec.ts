import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateNatGatewayRule } from './nat-gateway.rule.js';

function graph(nodes: ArchitectureGraph['nodes']): ArchitectureGraph {
  return { nodes, edges: [] };
}

describe('evaluateNatGatewayRule', () => {
  it('NAT Gateway가 1개뿐이면 위반으로 잡는다', () => {
    const result = evaluateNatGatewayRule(
      graph([{ id: 'nat1', type: 'NAT_GATEWAY', position: { x: 0, y: 0 }, data: { label: 'NAT' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['nat1']);
  });

  it('NAT Gateway가 2개 이상이면 통과한다', () => {
    const result = evaluateNatGatewayRule(
      graph([
        { id: 'nat1', type: 'NAT_GATEWAY', position: { x: 0, y: 0 }, data: { label: 'NAT1' } },
        { id: 'nat2', type: 'NAT_GATEWAY', position: { x: 1, y: 0 }, data: { label: 'NAT2' } },
      ]),
    );

    expect(result.passed).toBe(true);
  });

  it('NAT Gateway가 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateNatGatewayRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
