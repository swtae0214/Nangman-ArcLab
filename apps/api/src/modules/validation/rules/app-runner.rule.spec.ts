import type { ArchitectureGraph } from '@nangman/shared-types';
import { describe, expect, it } from 'vitest';
import { evaluateAppRunnerRule } from './app-runner.rule.js';

function graph(nodes: ArchitectureGraph['nodes']): ArchitectureGraph {
  return { nodes, edges: [] };
}

describe('evaluateAppRunnerRule', () => {
  it('최소 인스턴스 수를 지정 안 했으면 기본값(1)으로 보고 위반으로 잡는다', () => {
    const result = evaluateAppRunnerRule(
      graph([{ id: 'ar1', type: 'APP_RUNNER', position: { x: 0, y: 0 }, data: { label: 'AR' } }]),
    );

    expect(result.passed).toBe(false);
    expect(result.detail.nodeIds).toEqual(['ar1']);
  });

  it('최소 인스턴스 수가 2 이상이면 통과한다', () => {
    const result = evaluateAppRunnerRule(
      graph([
        { id: 'ar1', type: 'APP_RUNNER', position: { x: 0, y: 0 }, data: { label: 'AR', appRunnerMinInstanceCount: 2 } },
      ]),
    );

    expect(result.passed).toBe(true);
  });

  it('App Runner가 하나도 없으면 해당 없음으로 본다', () => {
    const result = evaluateAppRunnerRule(graph([]));
    expect(result.passed).toBe(true);
    expect(result.applicable).toBe(false);
  });
});
