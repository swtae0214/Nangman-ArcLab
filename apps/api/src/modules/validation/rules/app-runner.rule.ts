import type { ArchitectureGraph } from '@nangman/shared-types';
import type { RuleEvaluation } from './rule.types.js';

/** App Runner 자체 오토스케일링 설정의 기본 최소 인스턴스 수(AWS 콘솔 기본값) — 입력을 안 했으면 이 값으로 본다. */
const DEFAULT_APP_RUNNER_MIN_INSTANCE_COUNT = 1;

/**
 * APPRUNNER-001: App Runner의 최소 인스턴스 수(min size)가 2 이상인가.
 * ASG-001/FARGATE-001처럼 "노드를 여러 개 그려서 그룹으로 묶었는지"를 세는 게 아니다 —
 * App Runner는 서비스 하나당 박스 하나만 그리고, 이중화는 자체 오토스케일링 설정(최소
 * 인스턴스 수)으로 표현되기 때문에 그 값 자체를 확인한다.
 */
export function evaluateAppRunnerRule(graph: ArchitectureGraph): RuleEvaluation {
  const appRunnerNodes = graph.nodes.filter((node) => node.type === 'APP_RUNNER');

  // App Runner가 하나도 없으면 이중화 여부를 따질 대상 자체가 없다 — "해당 없음"으로 표시한다.
  if (appRunnerNodes.length === 0) {
    return { ruleCode: 'APPRUNNER-001', passed: true, applicable: false, detail: {} };
  }

  const violatingNodeIds = appRunnerNodes
    .filter((node) => (node.data.appRunnerMinInstanceCount ?? DEFAULT_APP_RUNNER_MIN_INSTANCE_COUNT) < 2)
    .map((node) => node.id);

  return {
    ruleCode: 'APPRUNNER-001',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
