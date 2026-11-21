"use client";

import { createContext, useContext } from "react";
import type { NodeCostLine } from "./node-cost";

/**
 * "비용 보기"가 켜져 있을 때만 LeafNode가 자기 아래에 월 예상 비용 라벨을 그리게 하는 스위치.
 */
const NodeCostContext = createContext(false);

export const NodeCostProvider = NodeCostContext.Provider;

export function useShowNodeCost(): boolean {
  return useContext(NodeCostContext);
}

/**
 * F5: 노드별 비용 상세(요금/일부반영 여부/미반영 사유) — ArchitectureCanvas가 summarizeArchitectureCost로
 * 한 번만 계산한 결과를 그대로 흘려보낸다. LeafNode가 프리셋표를 다시 조회해 직접 계산하면
 * instanceCount 반영이나 LOAD_BALANCER/CDN 사용량 기반 비용이 빠지는 등 비용 탭과 어긋날 수 있어서,
 * "단일 계산, 여러 화면에서 재사용"으로 통일한다.
 */
const NodeCostLineContext = createContext<ReadonlyMap<string, NodeCostLine>>(new Map());

export const NodeCostLineProvider = NodeCostLineContext.Provider;

export function useNodeCostLine(nodeId: string): NodeCostLine | undefined {
  return useContext(NodeCostLineContext).get(nodeId);
}
