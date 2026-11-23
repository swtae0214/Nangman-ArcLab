import { COMPUTE_COMPONENT_TYPES, IAM_GOVERNED_TARGET_TYPES, type ArchitectureGraph, type GraphEdge } from "@nangman/shared-types";

type Adjacency = Map<string, Set<string>>;

function buildReverseAdjacency(graph: ArchitectureGraph): Adjacency {
  const adjacency: Adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of graph.edges) adjacency.get(edge.target)?.add(edge.source);
  return adjacency;
}

function bfsReachable(adjacency: Adjacency, startIds: string[]): Set<string> {
  const visited = new Set(startIds);
  const queue = [...startIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

/**
 * 12단계: "외부 사용자의 요청이 LB·EC2·RDS를 거쳐 이동하는 흐름을 시각적으로 보여달라"는 피드백.
 * 백엔드 시뮬레이션 엔진(apps/api의 pipeline.util.ts)이 쓰는 것과 같은 패턴(시작점에서 정방향
 * BFS ∩ 도착점에서 역방향 BFS)을 그대로 가져오되, 시작점을 LOAD_BALANCER가 아니라 USER로 바꿔서
 * "사용자가 실제로 체감하는" 전체 구간을 구한다. 시뮬레이션 실행 여부와 무관하게 현재 그래프
 * 구조만으로 바로 계산되고, 저장되는 값이 아니라 화면 표시 전용이라 그래프 타입에 새 필드를
 * 추가하지 않는다.
 */
export function computeTrafficPathEdgeIds(graph: ArchitectureGraph): Set<string> {
  const { flowingEdgeIds } = computeTrafficFlowEdges(graph);
  return flowingEdgeIds;
}

/**
 * 14단계: 컴퓨트 노드(웹 서버/Lambda 등)에 IAM 권한이 없으면 실제로는 그 뒤로 요청이 못 간다는 걸
 * "트래픽 흐름 보기"에 반영한다. IAM 노드가 그래프에 있고 다른 노드와 최소 하나 연결돼 있을 때만
 * (= 사용자가 실제로 IAM을 신경 쓰고 있다는 신호) 검사를 켠다 — 안 그러면 IAM을 아예 안 그린
 * 다이어그램까지 전부 "막힘"으로 보여서 의미 없는 노이즈가 된다.
 *
 * "권한 없음"의 판정: 그 컴퓨트 노드에 IAM 연결이 아예 없거나, 있어도 전부
 * iamPermissionGranted:false로 꺼져 있으면 막힌 것으로 본다.
 */
function computeIamBlockedNodeIds(graph: ArchitectureGraph): Set<string> {
  const iamEdgesByComputeNodeId = groupIamEdgesByComputeNodeId(graph);
  if (iamEdgesByComputeNodeId === null) return new Set();

  const blocked = new Set<string>();
  for (const node of graph.nodes) {
    if (!COMPUTE_COMPONENT_TYPES.includes(node.type)) continue;
    const myIamEdges = iamEdgesByComputeNodeId.get(node.id) ?? [];
    if (myIamEdges.length === 0) {
      blocked.add(node.id);
      continue;
    }
    const anyGranted = myIamEdges.some((edge) => edge.iamPermissionGranted !== false);
    if (!anyGranted) blocked.add(node.id);
  }
  return blocked;
}

/** IAM 노드가 그래프에 없거나 아무 데도 연결 안 돼 있으면 null(= 검사 끔)을 돌려준다. */
function groupIamEdgesByComputeNodeId(graph: ArchitectureGraph): Map<string, GraphEdge[]> | null {
  const iamNodeIds = new Set(graph.nodes.filter((node) => node.type === "IAM").map((node) => node.id));
  if (iamNodeIds.size === 0) return null;

  const iamEdges = graph.edges.filter((edge) => iamNodeIds.has(edge.source) || iamNodeIds.has(edge.target));
  if (iamEdges.length === 0) return null;

  const byComputeNodeId = new Map<string, GraphEdge[]>();
  for (const edge of iamEdges) {
    const computeNodeId = iamNodeIds.has(edge.source) ? edge.target : edge.source;
    const list = byComputeNodeId.get(computeNodeId) ?? [];
    list.push(edge);
    byComputeNodeId.set(computeNodeId, list);
  }
  return byComputeNodeId;
}

/**
 * 14단계: IAM 노드 위 캔버스 배지("▲ 차단 N")용 — "트래픽 흐름 보기" 토글과 무관하게, 그 역할에
 * 연결된 전체 연결 중 권한이 꺼져 있는(iamPermissionGranted:false) 연결 개수를 센다. 디자인 검토
 * 피드백: "실험과 달리 마스터 스위치는 저장되는 설정을 바꾸니, 캔버스 배지로 꺼둔 상태를 계속
 * 알려줘야 한다."
 */
export function computeIamBlockedCountByNodeId(graph: ArchitectureGraph): Map<string, number> {
  const counts = new Map<string, number>();
  for (const node of graph.nodes) {
    if (node.type !== "IAM") continue;
    const blockedCount = graph.edges.filter(
      (edge) => (edge.source === node.id || edge.target === node.id) && edge.iamPermissionGranted === false,
    ).length;
    if (blockedCount > 0) counts.set(node.id, blockedCount);
  }
  return counts;
}

export interface TrafficFlowEdges {
  /** 정상적으로 흐르는 선 — 초록 애니메이션으로 강조한다. */
  flowingEdgeIds: Set<string>;
  /** IAM 권한이 없어서 실제로는 못 지나가는 선 — 빨간 점선+✕로 표시하고, 그 지점에서 흐름이 멈춘다. */
  blockedEdgeIds: Set<string>;
}

export function computeTrafficFlowEdges(graph: ArchitectureGraph): TrafficFlowEdges {
  const userIds = graph.nodes.filter((node) => node.type === "USER").map((node) => node.id);
  const seedIds = userIds.length > 0 ? userIds : graph.nodes.filter((node) => node.type === "LOAD_BALANCER").map((node) => node.id);
  const dbIds = graph.nodes
    .filter((node) => node.type === "DB_PRIMARY" || node.type === "DB_REPLICA")
    .map((node) => node.id);

  if (seedIds.length === 0 || dbIds.length === 0) return { flowingEdgeIds: new Set(), blockedEdgeIds: new Set() };

  const blockedNodeIds = computeIamBlockedNodeIds(graph);
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  // 디자인 검토 피드백: IAM 권한은 S3/DynamoDB/SQS 같은 AWS API 호출만 통제한다. DB 연결은
  // 보안 그룹·DB 계정으로 따로 통제되므로, "IAM 적용 대상"으로 가는 선만 막힌 것으로 본다.
  const isIamGovernedEdge = (edge: GraphEdge) => {
    const targetType = nodesById.get(edge.target)?.type;
    return targetType !== undefined && IAM_GOVERNED_TARGET_TYPES.includes(targetType);
  };

  const outgoingEdgesByNodeId = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const list = outgoingEdgesByNodeId.get(edge.source) ?? [];
    list.push(edge);
    outgoingEdgesByNodeId.set(edge.source, list);
  }

  // 막힌 노드에서 "IAM 적용 대상"으로 가는 선만 따라가지 않는다 — 그 외(DB 등)로 가는 선은 그대로
  // 따라가서, DB 경로까지 통째로 막힌 것처럼 보이지 않게 한다.
  const reachableFromSeed = new Set(seedIds);
  const queue = [...seedIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const currentIsBlocked = blockedNodeIds.has(current);
    for (const edge of outgoingEdgesByNodeId.get(current) ?? []) {
      if (currentIsBlocked && isIamGovernedEdge(edge)) continue;
      if (!reachableFromSeed.has(edge.target)) {
        reachableFromSeed.add(edge.target);
        queue.push(edge.target);
      }
    }
  }

  const canReachDb = bfsReachable(buildReverseAdjacency(graph), dbIds);
  const onPathNodeIds = new Set([...reachableFromSeed].filter((id) => canReachDb.has(id)));

  const flowingEdgeIds = new Set(
    graph.edges.filter((edge) => onPathNodeIds.has(edge.source) && onPathNodeIds.has(edge.target)).map((edge) => edge.id),
  );

  const blockedEdgeIds = new Set(
    graph.edges
      .filter((edge) => blockedNodeIds.has(edge.source) && reachableFromSeed.has(edge.source) && isIamGovernedEdge(edge))
      .map((edge) => edge.id),
  );

  return { flowingEdgeIds, blockedEdgeIds };
}
