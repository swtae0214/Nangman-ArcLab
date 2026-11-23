import type { ArchitectureGraph } from "@nangman/shared-types";
import { describe, expect, it } from "vitest";
import { computeTrafficFlowEdges, computeTrafficPathEdgeIds } from "./traffic-path";

function graph(nodes: ArchitectureGraph["nodes"], edges: ArchitectureGraph["edges"]): ArchitectureGraph {
  return { nodes, edges };
}

describe("computeTrafficPathEdgeIds", () => {
  it("USER부터 DB까지 이어지는 선만 강조 대상으로 본다", () => {
    const result = computeTrafficPathEdgeIds(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "lb1", type: "LOAD_BALANCER", position: { x: 1, y: 0 }, data: { label: "LB" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
        ],
        [
          { id: "e1", source: "user1", target: "lb1" },
          { id: "e2", source: "lb1", target: "db1" },
        ],
      ),
    );

    expect(result).toEqual(new Set(["e1", "e2"]));
  });
});

describe("computeTrafficFlowEdges (IAM 권한 반영)", () => {
  it("IAM 노드가 하나도 없으면 전부 정상 흐름으로 본다(막힘 없음)", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds.size).toBe(0);
  });

  it("IAM 노드가 있어도 아무 노드와도 연결 안 돼 있으면(B안) 막힘 없음으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "iam1", type: "IAM", position: { x: 3, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds.size).toBe(0);
  });

  it("IAM이 연결돼 있는데 이 컴퓨트 노드엔 IAM 연결이 없으면, 그 노드에서 나가는 선을 막힘으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "other_fn", type: "LAMBDA", position: { x: 0, y: 5 }, data: { label: "OtherFn" } },
          { id: "iam1", type: "IAM", position: { x: 3, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
          // IAM은 fn1이 아니라 다른 노드에만 연결 — 그래도 "IAM이 그래프 안에서 연결돼 있다"는 신호는 켜진다.
          { id: "e3", source: "iam1", target: "other_fn" },
        ],
      ),
    );

    // fn1은 IAM 연결이 없으므로, fn1에서 나가는 e2가 막힘으로 잡히고 db1까지는 흐름에서 빠진다.
    expect(result.flowingEdgeIds).toEqual(new Set(["e1"]));
    expect(result.blockedEdgeIds).toEqual(new Set(["e2"]));
  });

  it("IAM이 연결돼 있고 권한이 부여돼 있으면(기본값) 정상 흐름으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "iam1", type: "IAM", position: { x: 1, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
          { id: "e3", source: "iam1", target: "fn1" },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds.size).toBe(0);
  });

  it("IAM이 연결돼 있어도 iamPermissionGranted:false로 꺼두면 막힘으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "iam1", type: "IAM", position: { x: 1, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
          { id: "e3", source: "iam1", target: "fn1", iamPermissionGranted: false },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1"]));
    expect(result.blockedEdgeIds).toEqual(new Set(["e2"]));
  });
});
