import type { ArchitectureGraph } from '@nangman/shared-types';
import type { RuleEvaluation } from './rule.types.js';

/**
 * NAT-001: NAT Gateway가 1개뿐이면 경고. AWS는 가용 영역마다 NAT Gateway를 하나씩 두길
 * 권장한다 — NAT Gateway 하나는 그 가용 영역에 묶여 있어서, 그거 하나로 VPC 전체의 아웃바운드
 * 트래픽을 처리하게 두면 그 가용 영역(또는 NAT Gateway 자체)에 장애가 났을 때 다른 가용
 * 영역의 아웃바운드 트래픽까지 전부 끊긴다.
 *
 * 1차 버전은 "가용 영역별로 분산 배치됐는지"까지는 보지 않고 개수(2개 이상)만 확인한다 —
 * 더 정확하게 하려면 DB/캐시처럼 Multi-AZ 그룹 소속을 보는 방식이 필요한데, 범위를 넘어서서
 * 다음 작업으로 미룬다.
 */
export function evaluateNatGatewayRule(graph: ArchitectureGraph): RuleEvaluation {
  const natGatewayIds = graph.nodes.filter((node) => node.type === 'NAT_GATEWAY').map((node) => node.id);

  // NAT Gateway가 하나도 없으면 이중화 여부를 따질 대상 자체가 없다 — "해당 없음"으로 표시한다.
  if (natGatewayIds.length === 0) {
    return { ruleCode: 'NAT-001', passed: true, applicable: false, detail: {} };
  }

  const passed = natGatewayIds.length >= 2;
  return { ruleCode: 'NAT-001', passed, applicable: true, detail: passed ? {} : { nodeIds: natGatewayIds } };
}
