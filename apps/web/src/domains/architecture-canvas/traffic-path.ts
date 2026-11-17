import type { ArchitectureGraph } from "@nangman/shared-types";

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
  const userIds = graph.nodes.filter((node) => node.type === "USER").map((node) => node.id);
  const seedIds = userIds.length > 0 ? userIds : graph.nodes.filter((node) => node.type === "LOAD_BALANCER").map((node) => node.id);
  const dbIds = graph.nodes
    .filter((node) => node.type === "DB_PRIMARY" || node.type === "DB_REPLICA")
    .map((node) => node.id);

  if (seedIds.length === 0 || dbIds.length === 0) return new Set();

  const reachableFromSeed = bfsReachable(buildDirectedAdjacency(graph), seedIds);
  const canReachDb = bfsReachable(buildReverseAdjacency(graph), dbIds);
  const onPathNodeIds = new Set([...reachableFromSeed].filter((id) => canReachDb.has(id)));

  return new Set(
    graph.edges.filter((edge) => onPathNodeIds.has(edge.source) && onPathNodeIds.has(edge.target)).map((edge) => edge.id),
  );
}
