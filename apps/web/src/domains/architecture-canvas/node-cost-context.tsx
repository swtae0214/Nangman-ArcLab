"use client";

import { createContext, useContext } from "react";

/**
 * "비용 보기"가 켜져 있을 때만 LeafNode가 자기 아래에 월 예상 비용 라벨을 그리게 하는 스위치.
 * 노드별 비용은 프리셋표에서 바로 찾을 수 있는 값이라(트래픽 RPS처럼 그래프 전체를 계산할 필요가
 * 없어서) 맵이 아니라 read-only-context와 같은 boolean 패턴으로 충분하다.
 */
const NodeCostContext = createContext(false);

export const NodeCostProvider = NodeCostContext.Provider;

export function useShowNodeCost(): boolean {
  return useContext(NodeCostContext);
}
