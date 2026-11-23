import { COMPUTE_COMPONENT_TYPES, type ArchitectureGraph } from "@nangman/shared-types";

type Adjacency = Map<string, Set<string>>;

function buildDirectedAdjacency(graph: ArchitectureGraph): Adjacency {
  const adjacency: Adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of graph.edges) adjacency.get(edge.source)?.add(edge.target);
  return adjacency;
}

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
  const iamNodeIds = new Set(graph.nodes.filter((node) => node.type === "IAM").map((node) => node.id));
  if (iamNodeIds.size === 0) return new Set();

  const iamEdges = graph.edges.filter((edge) => iamNodeIds.has(edge.source) || iamNodeIds.has(edge.target));
  if (iamEdges.length === 0) return new Set();

  const blocked = new Set<string>();
  for (const node of graph.nodes) {
    if (!COMPUTE_COMPONENT_TYPES.includes(node.type)) continue;
    const myIamEdges = iamEdges.filter((edge) => edge.source === node.id || edge.target === node.id);
    if (myIamEdges.length === 0) {
      blocked.add(node.id);
      continue;
    }
    const anyGranted = myIamEdges.some((edge) => edge.iamPermissionGranted !== false);
    if (!anyGranted) blocked.add(node.id);
  }
  return blocked;
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
  const directedAdjacency = buildDirectedAdjacency(graph);

  // 막힌 노드에서 나가는 선은 따라가지 않는다 — 그 뒤로는 실제로 트래픽이 도달하지 못한다.
  const reachableFromSeed = new Set(seedIds);
  const queue = [...seedIds];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (blockedNodeIds.has(current)) continue;
    for (const next of directedAdjacency.get(current) ?? []) {
      if (!reachableFromSeed.has(next)) {
        reachableFromSeed.add(next);
        queue.push(next);
      }
    }
  }

  const canReachDb = bfsReachable(buildReverseAdjacency(graph), dbIds);
  const onPathNodeIds = new Set([...reachableFromSeed].filter((id) => canReachDb.has(id)));

  const flowingEdgeIds = new Set(
    graph.edges.filter((edge) => onPathNodeIds.has(edge.source) && onPathNodeIds.has(edge.target)).map((edge) => edge.id),
  );

  const blockedEdgeIds = new Set(
    graph.edges.filter((edge) => blockedNodeIds.has(edge.source) && reachableFromSeed.has(edge.source)).map((edge) => edge.id),
  );

  return { flowingEdgeIds, blockedEdgeIds };
}
