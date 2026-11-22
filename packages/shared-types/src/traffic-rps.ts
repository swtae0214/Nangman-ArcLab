import type { ArchitectureGraph, GraphEdge, GraphNode } from "./architecture.js";

export type TrafficEdgeKind = "distribution" | "call" | "replication";

/** (출발 타입 → 도착 타입) 쌍 중, 선 개수와 무관하게 항상 "복제"로 보는 예외. */
const REPLICATION_TYPE_PAIRS: ReadonlySet<string> = new Set(["DB_PRIMARY->DB_REPLICA"]);

/**
 * F6(A2): 호출(call) 엣지에 값을 직접 입력하지 않았을 때 쓰는 기본값 — 타입 쌍과 무관하게 전부
 * "1"이면 사용자(USER)부터 DB까지 같은 숫자(예: 400)가 아무 변화 없이 그대로 내려가 보여서 혼란을
 * 준다는 피드백(2026-11)으로, 흔히 인용되는 읽기 위주 웹 서비스의 읽기:쓰기 비율(약 90:10 —
 * https://algomaster.io/learn/system-design-interviews/high-read-traffic 등 시스템 설계 자료에서
 * 반복적으로 쓰이는 예시 비율)을 기본값으로 둔다. 언제든 연결 상세에서 직접 바꿀 수 있는 "기본값"일
 * 뿐, 실제 앱의 읽기/쓰기 비율을 측정한 값은 아니다.
 */
const DEFAULT_CALLS_PER_REQUEST_BY_TYPE_PAIR: ReadonlyMap<string, number> = new Map([
  ["WEB_SERVER->DB_PRIMARY", 0.1],
  ["WEB_SERVER->DB_REPLICA", 0.9],
]);

export function getDefaultCallsPerRequest(sourceType: GraphNode["type"], targetType: GraphNode["type"]): number {
  return DEFAULT_CALLS_PER_REQUEST_BY_TYPE_PAIR.get(`${sourceType}->${targetType}`) ?? 1;
}

/**
 * F6(A2): CDN 캐시 적중률 입력이 비어 있을 때 쓰는 기본값. 입력이 없으면 적중률 0%(= 전부
 * origin으로 전달)로 계산되던 것보다, 어떤 CDN이든 일정 비율은 캐시에 맞힌다고 보는 쪽이
 * 더 현실적인 기본 가정이라 80%로 둔다.
 */
export const DEFAULT_CDN_CACHE_HIT_RATIO_PERCENT = 80;

export interface NodeRpsOverrideMismatch {
  nodeId: string;
  /** 윗단에서 흘러온 값을 그대로 더했다면 나왔을 값. */
  expectedFromUpstream: number;
  /** 사용자가 직접 지정한 값(실제로 쓰인 값). */
  actual: number;
}

export interface NodeRpsResult {
  rpsByNodeId: Map<string, number>;
  /** "직접 지정"한 값이 윗단에서 들어오는 합과 달라서 생긴 안내 — 막지는 않고 알려주기만 한다. */
  overrideMismatches: NodeRpsOverrideMismatch[];
  /** 순환이 감지돼 이번 계산에서 끊어낸(=전파에서 제외한) 엣지 id들. */
  cyclicEdgeIds: Set<string>;
  /** F4: 전파에 쓴 위상 순서(입구에 가까운 노드부터) — "값이 흘러가는 모습" 같은 화면이 재사용한다. */
  order: string[];
}

/**
 * 엣지 종류는 저장하지 않고 매번 이렇게 추정한다 — 형제가 추가/삭제되면 추정도 자동으로 따라 바뀐다.
 * 1. (출발 타입, 도착 타입) 쌍이 예외표에 있으면 "복제".
 * 2. 그 외엔, 같은 출발 노드에서 "같은 도착 타입"으로 가는 선이 2개 이상이면 "분배"(형제끼리
 *    트래픽을 나눠 가짐), 1개뿐이면 "호출"(요청 1건당 독립적으로 n번 부름 — 기본 1번).
 * 사용자가 이 추정이 틀렸다고 직접 고른 경우에만 edge.trafficKindOverride에 저장해두고 그걸 우선한다.
 */
export function inferEdgeKind(
  edge: GraphEdge,
  nodesById: ReadonlyMap<string, GraphNode>,
  edgesBySourceId: ReadonlyMap<string, GraphEdge[]>,
): TrafficEdgeKind {
  if (edge.trafficKindOverride) return edge.trafficKindOverride;

  const sourceNode = nodesById.get(edge.source);
  const targetNode = nodesById.get(edge.target);
  if (!sourceNode || !targetNode) return "call";

  if (REPLICATION_TYPE_PAIRS.has(`${sourceNode.type}->${targetNode.type}`)) return "replication";

  const sameTargetTypeSiblings = (edgesBySourceId.get(edge.source) ?? []).filter(
    (candidate) => nodesById.get(candidate.target)?.type === targetNode.type,
  );
  return sameTargetTypeSiblings.length >= 2 ? "distribution" : "call";
}

/**
 * 트래픽(분배/호출) 선들만 보고 순환을 찾는다 — 복제선은 애초에 전파 대상이 아니라서 여기서도 뺀다.
 * 순환이 발견되면(예: 실수로 DB → 웹 서버 선을 그린 경우) 그 "닫히는 선" 하나만 순환으로 표시해서,
 * 전파 계산에서 그 선만 끊으면 나머지는 정상적으로 계산되게 한다 — 완전히 막지는 않는다.
 */
export function detectTrafficCycles(graph: ArchitectureGraph): Set<string> {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesBySourceId = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const list = edgesBySourceId.get(edge.source) ?? [];
    list.push(edge);
    edgesBySourceId.set(edge.source, list);
  }

  const trafficEdges = graph.edges.filter((edge) => inferEdgeKind(edge, nodesById, edgesBySourceId) !== "replication");
  const outgoing = new Map<string, GraphEdge[]>();
  for (const edge of trafficEdges) {
    const list = outgoing.get(edge.source) ?? [];
    list.push(edge);
    outgoing.set(edge.source, list);
  }

  const UNVISITED = 0;
  const IN_PROGRESS = 1;
  const DONE = 2;
  const state = new Map<string, number>(graph.nodes.map((node) => [node.id, UNVISITED]));
  const cyclicEdgeIds = new Set<string>();

  const visit = (nodeId: string) => {
    state.set(nodeId, IN_PROGRESS);
    for (const edge of outgoing.get(nodeId) ?? []) {
      const targetState = state.get(edge.target);
      if (targetState === IN_PROGRESS) {
        cyclicEdgeIds.add(edge.id);
      } else if (targetState === UNVISITED) {
        visit(edge.target);
      }
    }
    state.set(nodeId, DONE);
  };

  for (const node of graph.nodes) {
    if (state.get(node.id) === UNVISITED) visit(node.id);
  }

  return cyclicEdgeIds;
}

/**
 * 그래프 전체의 노드별 RPS를 계산한다. USER(입구) 노드에서 시작해서, 분배선은 가중치 비율로
 * 나누고 호출선은 "요청당 n번"을 곱해 더하며(fan-in은 합산), 위상 순서대로 앞에서 뒤로 전파한다.
 * 노드에 trafficOverrideRps가 있으면 윗단 계산과 무관하게 그 값을 그대로 쓰고(= 윗단과 끊어진
 * 별도 입구), 그 아래로는 이 값 기준으로 다시 전파된다.
 */
export function computeNodeRps(graph: ArchitectureGraph, options?: { peak?: boolean }): NodeRpsResult {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const edgesBySourceId = new Map<string, GraphEdge[]>();
  for (const edge of graph.edges) {
    const list = edgesBySourceId.get(edge.source) ?? [];
    list.push(edge);
    edgesBySourceId.set(edge.source, list);
  }

  const cyclicEdgeIds = detectTrafficCycles(graph);
  const effectiveEdges = graph.edges.filter((edge) => {
    const kind = inferEdgeKind(edge, nodesById, edgesBySourceId);
    return kind !== "replication" && !cyclicEdgeIds.has(edge.id);
  });

  const incomingByTarget = new Map<string, GraphEdge[]>();
  const outgoingBySource = new Map<string, string[]>();
  const inDegree = new Map<string, number>(graph.nodes.map((node) => [node.id, 0]));
  for (const edge of effectiveEdges) {
    incomingByTarget.set(edge.target, [...(incomingByTarget.get(edge.target) ?? []), edge]);
    outgoingBySource.set(edge.source, [...(outgoingBySource.get(edge.source) ?? []), edge.target]);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // 위상 정렬(Kahn's algorithm) — 부모를 반드시 먼저 계산해야 자식의 전파값을 구할 수 있다.
  const remainingInDegree = new Map(inDegree);
  const queue = graph.nodes.filter((node) => (remainingInDegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (nodeId === undefined) break;
    order.push(nodeId);
    for (const nextId of outgoingBySource.get(nodeId) ?? []) {
      const next = (remainingInDegree.get(nextId) ?? 0) - 1;
      remainingInDegree.set(nextId, next);
      if (next === 0) queue.push(nextId);
    }
  }
  // 순환 검사에서 못 끊어낸 예외적인 경우(이론상 없어야 하지만 안전망으로) 남은 노드를 뒤에 덧붙인다.
  const orderedIds = new Set(order);
  for (const node of graph.nodes) if (!orderedIds.has(node.id)) order.push(node.id);

  const rpsByNodeId = new Map<string, number>();
  const overrideMismatches: NodeRpsOverrideMismatch[] = [];

  for (const nodeId of order) {
    const node = nodesById.get(nodeId);
    if (!node) continue;
    const incoming = incomingByTarget.get(nodeId) ?? [];

    let computedFromUpstream = 0;
    for (const edge of incoming) {
      const sourceNode = nodesById.get(edge.source);
      // F4: CDN은 캐시가 맞든 틀리든 뷰어에게 응답은 다 내려주지만(= CDN 자신의 rpsByNodeId 값은
      // 그대로 둔다), origin(뒷단)으로는 캐시에 못 맞힌 비율만큼만 흘려보낸다 — 그래서 CDN에서
      // 나가는 선을 탈 때만 이 비율을 곱하고, rpsByNodeId 자체는 건드리지 않는다.
      const cdnPassThroughRatio =
        sourceNode?.type === "CDN" ? 1 - (sourceNode.data.cdnCacheHitRatioPercent ?? DEFAULT_CDN_CACHE_HIT_RATIO_PERCENT) / 100 : 1;
      const upstreamRps = (rpsByNodeId.get(edge.source) ?? 0) * cdnPassThroughRatio;
      const kind = inferEdgeKind(edge, nodesById, edgesBySourceId);
      if (kind === "distribution") {
        const siblings = (edgesBySourceId.get(edge.source) ?? []).filter(
          (candidate) => !cyclicEdgeIds.has(candidate.id) && nodesById.get(candidate.target)?.type === node.type,
        );
        const totalWeight = siblings.reduce((sum, sibling) => sum + (sibling.distributionWeight ?? 1), 0) || 1;
        computedFromUpstream += upstreamRps * ((edge.distributionWeight ?? 1) / totalWeight);
      } else {
        const defaultCallsPerRequest = sourceNode ? getDefaultCallsPerRequest(sourceNode.type, node.type) : 1;
        computedFromUpstream += upstreamRps * (edge.callsPerRequest ?? defaultCallsPerRequest);
      }
    }

    const override = node.data.trafficOverrideRps;
    if (override != null) {
      rpsByNodeId.set(nodeId, override);
      if (incoming.length > 0 && Math.abs(computedFromUpstream - override) > 1e-6) {
        overrideMismatches.push({ nodeId, expectedFromUpstream: computedFromUpstream, actual: override });
      }
      continue;
    }

    if (node.type === "USER") {
      const base = node.data.entryAvgRps ?? 0;
      const multiplier = options?.peak ? (node.data.entryPeakMultiplier ?? 1) : 1;
      rpsByNodeId.set(nodeId, base * multiplier);
      continue;
    }

    rpsByNodeId.set(nodeId, computedFromUpstream);
  }

  return { rpsByNodeId, overrideMismatches, cyclicEdgeIds, order };
}
