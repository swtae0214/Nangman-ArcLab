import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateFargateRule } from './fargate.rule.js';

function graph(nodes: ArchitectureGraph['nodes']): ArchitectureGraph {
  return { nodes, edges: [] };
}

describe('evaluateFargateRule', () => {
  it('Fargate가 ECS 서비스 안에 2개 있으면 통과한다', () => {
    const result = evaluateFargateRule(
      graph([
        { id: 'svc1', type: 'ECS_SERVICE', position: { x: 0, y: 0 }, data: { label: 'Service' } },
        { id: 'fg1', type: 'FARGATE', logicalGroupId: 'svc1', position: { x: 1, y: 0 }, data: { label: 'FG1' } },
        { id: 'fg2', type: 'FARGATE', logicalGroupId: 'svc1', position: { x: 2, y: 0 }, data: { label: 'FG2' } },
      ]),
    );

    expect(result.passed).toBe(true);
  });

  it('Fargate가 ECS 서비스 밖에 혼자 있으면 위반으로 잡는다', () => {
    const result = evaluateFargateRule(
      graph([{ id: 'fg1', type: 'FARGATE', position: { x: 0, y: 0 }, data: { label: 'FG' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['fg1']);
  });

  it('ASG(AUTO_SCALING_GROUP)에 들어있어도 ECS 서비스가 아니라서 위반으로 잡는다', () => {
    const result = evaluateFargateRule(
      graph([
        { id: 'asg1', type: 'AUTO_SCALING_GROUP', position: { x: 0, y: 0 }, data: { label: 'ASG' } },
        { id: 'fg1', type: 'FARGATE', logicalGroupId: 'asg1', position: { x: 1, y: 0 }, data: { label: 'FG' } },
      ]),
    );

    expect(result.passed).toBe(false);
  });

  it('Fargate가 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateFargateRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
