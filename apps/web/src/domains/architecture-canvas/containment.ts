import type { ComponentType } from "@nangman/shared-types";
import {
  COMPONENT_META,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  DEFAULT_LEAF_HEIGHT,
  DEFAULT_LEAF_WIDTH,
  LOGICAL_GROUP_TYPES,
} from "./component-meta";
import type { FlowNode } from "./types";

const LOGICAL_GROUP_TYPE_SET = new Set<ComponentType>(LOGICAL_GROUP_TYPES);

/**
 * 노드의 절대(캔버스 기준) 좌표를 구한다. React Flow는 자식 노드의 position을 "부모 기준 상대좌표"로
 * 저장하므로, 조상 체인을 따라 올라가며 각 단계의 position을 전부 더해야 진짜 절대좌표가 나온다.
 * (Region 안의 VPC 안의 Subnet처럼 2단계 이상 중첩되면 이 계산 없이는 좌표가 어긋난다.)
 */
export function getAbsolutePosition(node: FlowNode, nodesById: Map<string, FlowNode>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodesById.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

/** node가 ancestorId의 후손(자식/손자/…)인지 확인한다. */
export function isDescendantOf(node: FlowNode, ancestorId: string, nodesById: Map<string, FlowNode>): boolean {
  let current = node;
  while (current.parentId) {
    if (current.parentId === ancestorId) return true;
    const parent = nodesById.get(current.parentId);
    if (!parent) return false;
    current = parent;
  }
  return false;
}

/**
 * 드롭(또는 드래그로 다시 옮긴) 좌표가 어떤 그룹 노드 영역 안인지 찾는다. 여러 겹으로 중첩된
 * 그룹(Region>AZ>VPC>Subnet)이 겹쳐 있으면, 가장 바깥쪽이 아니라 가장 안쪽(가장 구체적인) 그룹을
 * 골라야 의도한 컨테이너에 들어간다.
 * excludeIds: 이미 캔버스에 있는 노드를 다시 옮길 때, 자기 자신이나 자기 자손을 새 부모로 고르면
 * 순환 참조가 생기므로 후보에서 빼기 위한 용도(팔레트에서 새로 드롭할 때는 안 씀).
 */
export function findGroupAt(nodes: FlowNode[], x: number, y: number, excludeIds?: ReadonlySet<string>): FlowNode | undefined {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const candidates = nodes.filter((node) => {
    if (excludeIds?.has(node.id)) return false;
    if (!COMPONENT_META[node.type].isGroup) return false;
    const abs = getAbsolutePosition(node, nodesById);
    const width = node.width ?? DEFAULT_GROUP_WIDTH;
    const height = node.height ?? DEFAULT_GROUP_HEIGHT;
    return x >= abs.x && x <= abs.x + width && y >= abs.y && y <= abs.y + height;
  });

  return candidates.reduce<FlowNode | undefined>((deepest, candidate) => {
    if (!deepest) return candidate;
    return isDescendantOf(candidate, deepest.id, nodesById) ? candidate : deepest;
  }, undefined);
}

/**
 * 드롭 좌표가 어떤 논리적 그룹(Target Group/ASG) 위인지 찾는다. 논리적 그룹은 항상 최상위(부모 없음)라
 * findGroupAt처럼 조상 체인을 따질 필요 없이 자기 position을 그대로 절대좌표로 쓰면 된다.
 * 팔레트에서 컴포넌트를 이 위에 드롭하면(예: 웹 서버를 ASG 박스 위에) parentId는 안 건드리고
 * logicalGroupId만 붙는다 — 물리적 소속과는 완전히 별개다.
 */
export function findLogicalGroupAt(nodes: FlowNode[], x: number, y: number): FlowNode | undefined {
  return nodes.find((node) => {
    if (!LOGICAL_GROUP_TYPE_SET.has(node.type)) return false;
    const width = node.width ?? DEFAULT_GROUP_WIDTH;
    const height = node.height ?? DEFAULT_GROUP_HEIGHT;
    return x >= node.position.x && x <= node.position.x + width && y >= node.position.y && y <= node.position.y + height;
  });
}

/** 노드의 대략적인 화면 크기. 실측(measured)값이 있으면 그걸, 없으면 타입에 맞는 기본값을 쓴다. */
export function getNodeSize(node: FlowNode): { width: number; height: number } {
  const isGroup = COMPONENT_META[node.type].isGroup;
  return {
    width: node.width ?? node.measured?.width ?? (isGroup ? DEFAULT_GROUP_WIDTH : DEFAULT_LEAF_WIDTH),
    height: node.height ?? node.measured?.height ?? (isGroup ? DEFAULT_GROUP_HEIGHT : DEFAULT_LEAF_HEIGHT),
  };
}

/**
 * 12단계: "리소스를 먼저 그리고 나중에 영역(컨테이너)을 그 위에 그리면 소속이 안 된다",
 * "컨테이너를 옮기거나 리사이즈해서 기존 리소스를 덮어도 소속이 안 된다"는 피드백 — 지금까지
 * onDrop/onNodeDragStop은 "방금 움직인 그 노드 하나"의 소속만 다시 계산했는데, 그 반대 방향
 * (컨테이너 쪽이 움직이거나 새로 생겨서 다른 노드를 덮는 경우)은 안 다뤘다. 노드 하나를 콕 집어
 * 계산하는 대신, 전체 노드에 대해 "지금 실제로 겹쳐 있는 가장 안쪽 컨테이너가 어디인지"를 다시
 * 묻는 것으로 통일했다 — 바뀐 게 없는 노드는 그대로 같은 답이 나와서 아무 일도 안 일어나고,
 * 새/이동/리사이즈된 컨테이너에 실제로 덮인 노드만 소속이 갱신된다(컨테이너가 작아져서 더 이상
 * 안 덮으면 자동으로 빠지는 것도 같은 원리로 같이 해결된다). 논리적 그룹(ASG/Target Group)은
 * 이번 범위에서 계속 제외한다.
 *
 * 노드 하나씩 순서대로 처리하면서 매번 결과를 반영한 뒤 다음 노드를 계산한다(한 번에 전부
 * 스냅샷 기준으로 계산하지 않음). 그렇게 안 하면, 크기가 비슷한 두 컨테이너를 서로 많이 겹치게
 * 옮겼을 때 "A의 중심이 B 안에, 동시에 B의 중심도 A 안에" 들어가는 경우 둘이 서로를 부모로
 * 삼으려는 순환 참조가 생길 수 있다. 순서대로 처리하면, 먼저 처리된 쪽이 나중 노드의 "이미
 * 자손이 된 노드는 후보에서 제외" 규칙에 걸려 순환이 생기지 않는다.
 */
export function resolveContainment(nodesList: FlowNode[]): FlowNode[] {
  let working = nodesList;
  for (let i = 0; i < working.length; i++) {
    const node = working[i];
    if (LOGICAL_GROUP_TYPE_SET.has(node.type)) continue;

    const nodesById = new Map(working.map((n) => [n.id, n]));
    const abs = getAbsolutePosition(node, nodesById);
    const size = getNodeSize(node);
    const centerX = abs.x + size.width / 2;
    const centerY = abs.y + size.height / 2;

    const excludeIds = new Set([node.id, ...working.filter((n) => isDescendantOf(n, node.id, nodesById)).map((n) => n.id)]);
    const newParent = findGroupAt(working, centerX, centerY, excludeIds);
    const newParentId = newParent?.id;
    if (newParentId === node.parentId) continue;

    const newPosition = newParent
      ? { x: abs.x - getAbsolutePosition(newParent, nodesById).x, y: abs.y - getAbsolutePosition(newParent, nodesById).y }
      : abs;
    const { parentId: _oldParentId, ...rest } = node;
    const updatedNode = { ...rest, position: newPosition, ...(newParentId ? { parentId: newParentId } : {}) };
    working = working.map((n, index) => (index === i ? updatedNode : n));
  }
  return working;
}
