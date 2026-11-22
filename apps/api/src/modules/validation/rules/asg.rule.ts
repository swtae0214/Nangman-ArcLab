import { ASG_CAPABLE_COMPUTE_TYPES, type ArchitectureGraph } from '@nangman/shared-types';
import { buildNodesById } from '../graph.util.js';
import type { RuleEvaluation } from './rule.types.js';

/**
 * ASG-001: 웹 서버/ECS/Elastic Beanstalk가 Auto Scaling Group에 속해 있고, 그 안에 최소 2대
 * 있는가. "최소 인스턴스 수"를 별도 입력값으로 받지 않고, 캔버스에 실제로 배치된 개수를 그대로 센다.
 *
 * ASG_CAPABLE_COMPUTE_TYPES에는 실제로 AWS EC2 Auto Scaling Group을 쓰는 타입만 들어있다 —
 * Lambda(인스턴스 개념 자체가 없음), Fargate/App Runner(ASG가 아니라 각자 다른 메커니즘으로
 * 스케일링)는 이 규칙의 대상이 아니다.
 *
 * 9단계에서 Auto Scaling Group을 물리적 그룹(parentId 소속)에서 Target Group과 같은
 * 논리적 그룹(logicalGroupId 표시)으로 바꿨다 — 실제 AWS의 ASG도 하나의 서브넷 안에 갇히지 않고
 * 여러 AZ/서브넷에 걸쳐 있는 게 정상이라, 물리적 포함 관계로는 이 구조를 표현할 수 없었다.
 * 그래서 이 규칙도 parentId 조상 체인이 아니라 logicalGroupId로 ASG 소속을 판단한다.
 */
export function evaluateAsgRule(graph: ArchitectureGraph): RuleEvaluation {
  const nodesById = buildNodesById(graph);
  const asgCapableNodes = graph.nodes.filter((node) => ASG_CAPABLE_COMPUTE_TYPES.includes(node.type));

  // 대상 컴퓨트가 하나도 없으면 ASG 구성 여부를 따질 대상 자체가 없다 — "해당 없음"으로 표시한다.
  if (asgCapableNodes.length === 0) {
    return { ruleCode: 'ASG-001', passed: true, applicable: false, detail: {} };
  }

  const notInAsg: string[] = [];
  const asgMemberCounts = new Map<string, number>();

  const findAsgGroupId = (node: (typeof asgCapableNodes)[number]): string | undefined => {
    const groupId = node.logicalGroupId;
    if (!groupId) return undefined;
    const group = nodesById.get(groupId);
    return group?.type === 'AUTO_SCALING_GROUP' ? groupId : undefined;
  };

  for (const node of asgCapableNodes) {
    const asgId = findAsgGroupId(node);
    if (!asgId) {
      notInAsg.push(node.id);
      continue;
    }
    asgMemberCounts.set(asgId, (asgMemberCounts.get(asgId) ?? 0) + 1);
  }

  const underMinimumIds = asgCapableNodes
    .filter((node) => {
      const asgId = findAsgGroupId(node);
      if (!asgId) return false;
      return (asgMemberCounts.get(asgId) ?? 0) < 2;
    })
    .map((node) => node.id);

  const violatingNodeIds = [...new Set([...notInAsg, ...underMinimumIds])];

  return {
    ruleCode: 'ASG-001',
    passed: violatingNodeIds.length === 0,
    applicable: true,
    detail: violatingNodeIds.length > 0 ? { nodeIds: violatingNodeIds } : {},
  };
}
