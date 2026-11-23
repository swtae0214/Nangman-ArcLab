import type { ArchitectureGraph } from "@nangman/shared-types";
import { describe, expect, it } from "vitest";
import { computeIamBlockedCountByNodeId, computeTrafficFlowEdges, computeTrafficPathEdgeIds } from "./traffic-path";

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

  it("권한이 없어도 DB로 가는 선은 막지 않는다 — DB 연결은 IAM이 아니라 DB 계정·보안 그룹으로 통제된다", () => {
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
          // IAM은 fn1이 아니라 다른 노드에만 연결 — 그래도 "IAM이 그래프 안에서 연결돼 있다"는 신호는 켜져서
          // fn1은 "권한 없음"으로 판정되지만, db1으로 가는 선은 IAM 적용 대상이 아니라 그대로 흘러야 한다.
          { id: "e3", source: "iam1", target: "other_fn" },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds.size).toBe(0);
  });

  it("IAM 연결이 없는 컴퓨트 노드에서 S3(IAM 적용 대상)로 가는 선은 막힘으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "bucket1", type: "S3", position: { x: 1, y: 5 }, data: { label: "Bucket" } },
          { id: "other_fn", type: "LAMBDA", position: { x: 0, y: 5 }, data: { label: "OtherFn" } },
          { id: "iam1", type: "IAM", position: { x: 3, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
          { id: "e3", source: "fn1", target: "bucket1" },
          { id: "e4", source: "iam1", target: "other_fn" },
        ],
      ),
    );

    // db1으로 가는 e2는 그대로 흐르고, S3로 가는 e3만 막힌다.
    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds).toEqual(new Set(["e3"]));
  });

  it("IAM이 연결돼 있고 권한이 부여돼 있으면(기본값) S3로 가는 선도 정상 흐름으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "bucket1", type: "S3", position: { x: 1, y: 5 }, data: { label: "Bucket" } },
          { id: "iam1", type: "IAM", position: { x: 1, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
          { id: "e3", source: "fn1", target: "bucket1" },
          { id: "e4", source: "iam1", target: "fn1" },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds.size).toBe(0);
  });

  it("IAM이 연결돼 있어도 iamPermissionGranted:false로 꺼두면 S3로 가는 선을 막힘으로 본다", () => {
    const result = computeTrafficFlowEdges(
      graph(
        [
          { id: "user1", type: "USER", position: { x: 0, y: 0 }, data: { label: "User" } },
          { id: "fn1", type: "LAMBDA", position: { x: 1, y: 0 }, data: { label: "Fn" } },
          { id: "db1", type: "DB_PRIMARY", position: { x: 2, y: 0 }, data: { label: "DB" } },
          { id: "bucket1", type: "S3", position: { x: 1, y: 5 }, data: { label: "Bucket" } },
          { id: "iam1", type: "IAM", position: { x: 1, y: 3 }, data: { label: "IAM" } },
        ],
        [
          { id: "e1", source: "user1", target: "fn1" },
          { id: "e2", source: "fn1", target: "db1" },
          { id: "e3", source: "fn1", target: "bucket1" },
          { id: "e4", source: "iam1", target: "fn1", iamPermissionGranted: false },
        ],
      ),
    );

    expect(result.flowingEdgeIds).toEqual(new Set(["e1", "e2"]));
    expect(result.blockedEdgeIds).toEqual(new Set(["e3"]));
  });
});

describe("computeIamBlockedCountByNodeId (IAM 노드 캔버스 배지)", () => {
  it("권한이 꺼진 연결이 없으면 배지를 주지 않는다", () => {
    const result = computeIamBlockedCountByNodeId(
      graph(
        [
          { id: "fn1", type: "LAMBDA", position: { x: 0, y: 0 }, data: { label: "Fn" } },
          { id: "iam1", type: "IAM", position: { x: 1, y: 0 }, data: { label: "app-role" } },
        ],
        [{ id: "e1", source: "iam1", target: "fn1" }],
      ),
    );

    expect(result.size).toBe(0);
  });

  it("권한이 꺼진 연결 개수를 센다 — 트래픽 흐름 보기 토글과 무관하다", () => {
    const result = computeIamBlockedCountByNodeId(
      graph(
        [
          { id: "fn1", type: "LAMBDA", position: { x: 0, y: 0 }, data: { label: "Fn1" } },
          { id: "fn2", type: "LAMBDA", position: { x: 0, y: 1 }, data: { label: "Fn2" } },
          { id: "iam1", type: "IAM", position: { x: 1, y: 0 }, data: { label: "app-role" } },
        ],
        [
          { id: "e1", source: "iam1", target: "fn1", iamPermissionGranted: false },
          { id: "e2", source: "iam1", target: "fn2" },
        ],
      ),
    );

    expect(result.get("iam1")).toBe(1);
  });
});
