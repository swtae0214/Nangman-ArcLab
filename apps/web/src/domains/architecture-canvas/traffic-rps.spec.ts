import type { ArchitectureGraph, GraphEdge, GraphNode } from "@nangman/shared-types";
import { describe, expect, it } from "vitest";
import { computeNodeRps, detectTrafficCycles, inferEdgeKind } from "./traffic-rps";

function node(id: string, type: GraphNode["type"], overrides: Partial<GraphNode["data"]> = {}): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: id, ...overrides } };
}

function edge(id: string, source: string, target: string, overrides: Partial<GraphEdge> = {}): GraphEdge {
  return { id, source, target, ...overrides };
}

describe("inferEdgeKind", () => {
  it("한 출발 노드에서 같은 도착 타입으로 가는 선이 2개 이상이면 분배로 본다", () => {
    const nodes = [node("lb", "LOAD_BALANCER"), node("web1", "WEB_SERVER"), node("web2", "WEB_SERVER")];
    const edges = [edge("e1", "lb", "web1"), edge("e2", "lb", "web2")];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const edgesBySourceId = new Map([["lb", edges]]);
    expect(inferEdgeKind(edges[0], nodesById, edgesBySourceId)).toBe("distribution");
  });

  it("도착 타입이 서로 다르면(선이 1개뿐이면) 호출로 본다", () => {
    const nodes = [node("web", "WEB_SERVER"), node("cache", "CACHE"), node("db", "DB_PRIMARY")];
    const edges = [edge("e1", "web", "cache"), edge("e2", "web", "db")];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const edgesBySourceId = new Map([["web", edges]]);
    expect(inferEdgeKind(edges[0], nodesById, edgesBySourceId)).toBe("call");
    expect(inferEdgeKind(edges[1], nodesById, edgesBySourceId)).toBe("call");
  });

  it("DB_PRIMARY -> DB_REPLICA는 항상 복제로 본다(선이 하나뿐이어도)", () => {
    const nodes = [node("primary", "DB_PRIMARY"), node("replica", "DB_REPLICA")];
    const edges = [edge("e1", "primary", "replica")];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const edgesBySourceId = new Map([["primary", edges]]);
    expect(inferEdgeKind(edges[0], nodesById, edgesBySourceId)).toBe("replication");
  });

  it("trafficKindOverride가 있으면 추정 대신 그 값을 그대로 쓴다", () => {
    const nodes = [node("web", "WEB_SERVER"), node("cache", "CACHE")];
    const edges = [edge("e1", "web", "cache", { trafficKindOverride: "distribution" })];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const edgesBySourceId = new Map([["web", edges]]);
    expect(inferEdgeKind(edges[0], nodesById, edgesBySourceId)).toBe("distribution");
  });
});

describe("computeNodeRps", () => {
  it("USER의 평상시 RPS가 분배선을 타고 형제 수만큼 균등하게 나뉜다", () => {
    const graph: ArchitectureGraph = {
      nodes: [
        node("user", "USER", { entryAvgRps: 100 }),
        node("lb", "LOAD_BALANCER"),
        node("web1", "WEB_SERVER"),
        node("web2", "WEB_SERVER"),
      ],
      edges: [edge("e1", "user", "lb"), edge("e2", "lb", "web1"), edge("e3", "lb", "web2")],
    };
    const result = computeNodeRps(graph);
    expect(result.rpsByNodeId.get("user")).toBe(100);
    expect(result.rpsByNodeId.get("lb")).toBe(100);
    expect(result.rpsByNodeId.get("web1")).toBe(50);
    expect(result.rpsByNodeId.get("web2")).toBe(50);
  });

  it("가중치가 다르면 가중치 비율대로 나뉜다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("user", "USER", { entryAvgRps: 100 }), node("web1", "WEB_SERVER"), node("web2", "WEB_SERVER")],
      edges: [
        edge("e1", "user", "web1", { distributionWeight: 7 }),
        edge("e2", "user", "web2", { distributionWeight: 3 }),
      ],
    };
    const result = computeNodeRps(graph);
    expect(result.rpsByNodeId.get("web1")).toBeCloseTo(70);
    expect(result.rpsByNodeId.get("web2")).toBeCloseTo(30);
  });

  it("호출선은 요청당 횟수를 곱하고, 여러 곳에서 모이면(fan-in) 합산된다", () => {
    const graph: ArchitectureGraph = {
      nodes: [
        node("web1", "WEB_SERVER", { trafficOverrideRps: 24 }),
        node("web2", "WEB_SERVER", { trafficOverrideRps: 24 }),
        node("db", "DB_PRIMARY"),
      ],
      edges: [
        edge("e1", "web1", "db", { callsPerRequest: 0.6 }),
        edge("e2", "web2", "db", { callsPerRequest: 0.6 }),
      ],
    };
    const result = computeNodeRps(graph);
    expect(result.rpsByNodeId.get("db")).toBeCloseTo(24 * 0.6 + 24 * 0.6);
  });

  it("복제선은 트래픽 전파에서 제외된다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("primary", "DB_PRIMARY", { trafficOverrideRps: 100 }), node("replica", "DB_REPLICA")],
      edges: [edge("e1", "primary", "replica")],
    };
    const result = computeNodeRps(graph);
    expect(result.rpsByNodeId.get("replica")).toBe(0);
  });

  it("직접 지정한 값이 윗단 합과 다르면 경고가 생기지만, 그 값을 그대로 쓴다", () => {
    const graph: ArchitectureGraph = {
      nodes: [
        node("user", "USER", { entryAvgRps: 100 }),
        node("lb", "LOAD_BALANCER"),
        node("web1", "WEB_SERVER", { trafficOverrideRps: 999 }),
      ],
      edges: [edge("e1", "user", "lb"), edge("e2", "lb", "web1")],
    };
    const result = computeNodeRps(graph);
    expect(result.rpsByNodeId.get("web1")).toBe(999);
    expect(result.overrideMismatches).toEqual([{ nodeId: "web1", expectedFromUpstream: 100, actual: 999 }]);
  });

  it("피크 배수는 peak 옵션을 켰을 때만 적용된다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("user", "USER", { entryAvgRps: 100, entryPeakMultiplier: 3 })],
      edges: [],
    };
    expect(computeNodeRps(graph).rpsByNodeId.get("user")).toBe(100);
    expect(computeNodeRps(graph, { peak: true }).rpsByNodeId.get("user")).toBe(300);
  });

  it("순환이 생기면 닫히는 선을 끊어서 계산하고, 그 선을 cyclicEdgeIds로 알려준다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("a", "WEB_SERVER", { trafficOverrideRps: 10 }), node("b", "DB_PRIMARY")],
      edges: [edge("e1", "a", "b"), edge("e2", "b", "a")],
    };
    const cyclicEdgeIds = detectTrafficCycles(graph);
    expect(cyclicEdgeIds.size).toBe(1);
    const result = computeNodeRps(graph);
    expect(result.cyclicEdgeIds.size).toBe(1);
    expect(result.rpsByNodeId.get("a")).toBe(10);
  });

  it("F4: CDN은 자기 자신에 도착한 RPS는 그대로 두고, origin(뒷단)으로는 캐시 적중률만큼 줄여서 흘려보낸다", () => {
    const graph: ArchitectureGraph = {
      nodes: [
        node("user", "USER", { entryAvgRps: 120 }),
        node("cdn", "CDN", { cdnCacheHitRatioPercent: 80 }),
        node("lb", "LOAD_BALANCER"),
      ],
      edges: [edge("e1", "user", "cdn"), edge("e2", "cdn", "lb")],
    };
    const { rpsByNodeId } = computeNodeRps(graph);
    expect(rpsByNodeId.get("cdn")).toBe(120);
    expect(rpsByNodeId.get("lb")).toBeCloseTo(24, 5);
  });

  it("F6(A2): CDN 적중률을 안 정했으면 기본값 80%로 계산한다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("user", "USER", { entryAvgRps: 100 }), node("cdn", "CDN"), node("lb", "LOAD_BALANCER")],
      edges: [edge("e1", "user", "cdn"), edge("e2", "cdn", "lb")],
    };
    expect(computeNodeRps(graph).rpsByNodeId.get("lb")).toBeCloseTo(20, 5);
  });

  it("F6(A2): 웹서버→DB Primary/Replica 호출값을 안 정했으면 타입 쌍 기본값(쓰기 10%·읽기 90%)으로 계산한다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("web", "WEB_SERVER", { trafficOverrideRps: 100 }), node("primary", "DB_PRIMARY"), node("replica", "DB_REPLICA")],
      edges: [edge("e1", "web", "primary"), edge("e2", "web", "replica")],
    };
    const { rpsByNodeId } = computeNodeRps(graph);
    expect(rpsByNodeId.get("primary")).toBeCloseTo(10, 5);
    expect(rpsByNodeId.get("replica")).toBeCloseTo(90, 5);
  });

  it("F6(A2): 타입 쌍 기본값이 없는 호출(예: 웹서버→캐시)은 그대로 1배다", () => {
    const graph: ArchitectureGraph = {
      nodes: [node("web", "WEB_SERVER", { trafficOverrideRps: 100 }), node("cache", "CACHE")],
      edges: [edge("e1", "web", "cache")],
    };
    expect(computeNodeRps(graph).rpsByNodeId.get("cache")).toBe(100);
  });
});
