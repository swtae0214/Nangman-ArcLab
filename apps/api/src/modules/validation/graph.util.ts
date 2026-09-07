import type { ArchitectureGraph, GraphNode } from '@nangman/shared-types';

export type Adjacency = Map<string, Set<string>>;

export function buildUndirectedAdjacency(graph: ArchitectureGraph): Adjacency {
  const adjacency: Adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }
  return adjacency;
}

export function buildNodesById(graph: ArchitectureGraph): Map<string, GraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

/** source -> target 방향으로만 따라가는 인접 리스트 (5단계 트래픽 흐름 계산용). */
export function buildDirectedAdjacency(graph: ArchitectureGraph): Adjacency {
  const adjacency: Adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
  }
  return adjacency;
}

/** target -> source, 즉 buildDirectedAdjacency의 반대 방향 인접 리스트. "여기로 들어오는" 관계를 따라갈 때 쓴다. */
export function buildReverseAdjacency(graph: ArchitectureGraph): Adjacency {
  const adjacency: Adjacency = new Map(graph.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of graph.edges) {
    adjacency.get(edge.target)?.add(edge.source);
  }
  return adjacency;
}

/** startIds에서 인접 리스트를 따라 BFS로 도달 가능한 모든 노드(시작점 포함)를 구한다. */
export function bfsReachable(adjacency: Adjacency, startIds: string[]): Set<string> {
  const visited = new Set<string>(startIds);
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
 * 절단점(articulation point) 탐지 — Tarjan's algorithm.
 * "이 노드를 지우면 그래프가 두 조각 이상으로 쪼개지는가?"를 DFS 한 번으로 판정한다.
 * (discovery[u] = u를 처음 방문한 순번, low[u] = u에서 역방향 간선을 통해 되돌아갈 수 있는
 *  가장 이른 조상의 순번. 자식 v의 low가 u의 discovery보다 앞서지 못하면, v는 u를 거치지 않고는
 *  더 위 조상으로 못 돌아간다는 뜻이므로 u가 절단점이다.)
 */
export function findArticulationPoints(nodeIds: string[], adjacency: Adjacency): Set<string> {
  const visited = new Set<string>();
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const articulationPoints = new Set<string>();
  let timer = 0;

  function dfs(u: string, parent: string | null): void {
    visited.add(u);
    discovery.set(u, timer);
    low.set(u, timer);
    timer += 1;
    let childCount = 0;

    for (const v of adjacency.get(u) ?? []) {
      if (v === parent) continue;

      if (visited.has(v)) {
        low.set(u, Math.min(low.get(u) ?? Infinity, discovery.get(v) ?? Infinity));
        continue;
      }

      childCount += 1;
      dfs(v, u);
      low.set(u, Math.min(low.get(u) ?? Infinity, low.get(v) ?? Infinity));

      const isRoot = parent === null;
      if (isRoot && childCount > 1) {
        articulationPoints.add(u);
      }
      if (!isRoot && (low.get(v) ?? Infinity) >= (discovery.get(u) ?? Infinity)) {
        articulationPoints.add(u);
      }
    }
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) dfs(id, null);
  }

  return articulationPoints;
}

/** exclude 노드를 제거한 그래프에서, from이 targets 중 하나에라도 도달 가능한지 BFS로 확인한다. */
export function canReachAnyExcluding(adjacency: Adjacency, from: string, targets: Set<string>, exclude: string): boolean {
  if (from === exclude) return false;

  const visited = new Set<string>([exclude, from]);
  const queue: string[] = [from];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    if (targets.has(current)) return true;

    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return false;
}

/** node의 parentId를 따라 올라가며 만나는 조상 그룹 노드들의 type을 모은다 (순환 참조 방지 포함). */
export function findAncestorTypes(node: GraphNode, nodesById: Map<string, GraphNode>): Set<string> {
  const types = new Set<string>();
  const seen = new Set<string>([node.id]);
  let current: GraphNode | undefined = node;

  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent: GraphNode | undefined = nodesById.get(current.parentId);
    if (!parent) break;
    types.add(parent.type);
    current = parent;
  }

  return types;
}
