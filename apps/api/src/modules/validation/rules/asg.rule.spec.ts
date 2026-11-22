import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateAsgRule } from './asg.rule.js';

function graph(nodes: ArchitectureGraph['nodes'], edges: ArchitectureGraph['edges']): ArchitectureGraph {
  return { nodes, edges };
}

describe('evaluateAsgRule', () => {
  it('ECS가 ASG 안에 2대 있으면 통과한다', () => {
    const result = evaluateAsgRule(
      graph(
        [
          { id: 'asg1', type: 'AUTO_SCALING_GROUP', position: { x: 0, y: 0 }, data: { label: 'ASG' } },
          { id: 'ecs1', type: 'ECS', logicalGroupId: 'asg1', position: { x: 1, y: 0 }, data: { label: 'ECS1' } },
          { id: 'ecs2', type: 'ECS', logicalGroupId: 'asg1', position: { x: 2, y: 0 }, data: { label: 'ECS2' } },
        ],
        [],
      ),
    );

    expect(result.passed).toBe(true);
  });

  it('Elastic Beanstalk가 ASG 밖에 혼자 있으면 위반으로 잡는다', () => {
    const result = evaluateAsgRule(
      graph([{ id: 'eb1', type: 'ELASTIC_BEANSTALK', position: { x: 0, y: 0 }, data: { label: 'EB' } }], []),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['eb1']);
  });

  /**
   * Fargate/App Runner는 애초에 EC2 Auto Scaling Group을 쓰지 않는 서비스라(각각 ECS 서비스
   * 태스크 수, 자체 동시성 기반 스케일링으로 동작), 이 규칙 대상이 아니다. Lambda는 "인스턴스"라는
   * 개념 자체가 없다. 셋 다 ASG_CAPABLE_COMPUTE_TYPES에서 빠져 있는지 회귀 테스트로 고정해둔다.
   */
  it('Fargate/App Runner/Lambda는 ASG 밖에 혼자 있어도 해당 없음이다(ASG 자체를 안 쓰는 서비스)', () => {
    const result = evaluateAsgRule(
      graph(
        [
          { id: 'fg1', type: 'FARGATE', position: { x: 0, y: 0 }, data: { label: 'Fargate' } },
          { id: 'ar1', type: 'APP_RUNNER', position: { x: 1, y: 0 }, data: { label: 'AppRunner' } },
          { id: 'fn1', type: 'LAMBDA', position: { x: 2, y: 0 }, data: { label: 'Fn' } },
        ],
        [],
      ),
    );

    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });

  it('대상 컴퓨트가 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateAsgRule(graph([], []));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
