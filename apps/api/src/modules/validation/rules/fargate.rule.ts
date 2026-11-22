import type { ArchitectureGraph } from '@nangman/shared-types';
import { buildNodesById } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/**
 * FARGATE-001: Fargate 컨테이너가 ECS 서비스로 묶여 있고, 그 안에 최소 2개 있는가.
 * ASG-001과 성격은 같지만(최소 2대 이중화), Fargate는 EC2 Auto Scaling Group을 쓰지 않고
 * ECS 서비스의 "원하는 태스크 수"로 스케일링하기 때문에 별도 규칙·별도 논리적 그룹
 * (ECS_SERVICE)으로 분리했다 — asg.rule.ts의 "ASG_CAPABLE_COMPUTE_TYPES에서 Fargate를
 * 왜 뺐는지" 설명 참고.
 */
export function evaluateFargateRule(graph: ArchitectureGraph): RuleEvaluation {
  const nodesById = buildNodesById(graph);
  const fargateNodes = graph.nodes.filter((node) => node.type === 'FARGATE');

  // Fargate 컨테이너가 하나도 없으면 이중화 여부를 따질 대상 자체가 없다 — "해당 없음"으로 표시한다.
  if (fargateNodes.length === 0) {
    return { ruleCode: 'FARGATE-001', passed: true, applicable: false, detail: {} };
  }

  const notInService: string[] = [];
  const serviceMemberCounts = new Map<string, number>();

  const findServiceId = (node: (typeof fargateNodes)[number]): string | undefined => {
    const groupId = node.logicalGroupId;
    if (!groupId) return undefined;
    const group = nodesById.get(groupId);
    return group?.type === 'ECS_SERVICE' ? groupId : undefined;
  };

  for (const node of fargateNodes) {
    const serviceId = findServiceId(node);
    if (!serviceId) {
      notInService.push(node.id);
      continue;
    }
    serviceMemberCounts.set(serviceId, (serviceMemberCounts.get(serviceId) ?? 0) + 1);
  }

  const underMinimumIds = fargateNodes
    .filter((node) => {
      const serviceId = findServiceId(node);
      if (!serviceId) return false;
      return (serviceMemberCounts.get(serviceId) ?? 0) < 2;
    })
    .map((node) => node.id);

  const violatingNodeIds = [...new Set([...notInService, ...underMinimumIds])];

  return {
    ruleCode: 'FARGATE-001',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
