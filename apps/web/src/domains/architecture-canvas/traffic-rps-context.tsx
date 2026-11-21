"use client";

import { createContext, useContext } from "react";

const EMPTY_RPS_BY_NODE_ID: ReadonlyMap<string, number> = new Map();

/**
 * "트래픽(RPS) 표시"가 켜져 있을 때, 노드별로 계산된 RPS를 캔버스 노드 렌더러(LeafNode)에
 * 전달하는 통로. 저장되는 그래프 JSON과 무관한 "현재 세션의 계산 결과 표시"라서
 * problem-nodes-context와 같은 패턴으로 node.data가 아닌 별도 Context로 흘려보낸다.
 * 토글이 꺼져 있으면 빈 Map을 그대로 두어, LeafNode 쪽에서 "값이 없으면 안 그린다"가 자동으로 된다.
 */
const TrafficRpsContext = createContext<ReadonlyMap<string, number>>(EMPTY_RPS_BY_NODE_ID);

export const TrafficRpsProvider = TrafficRpsContext.Provider;

export function useTrafficRpsByNodeId(): ReadonlyMap<string, number> {
  return useContext(TrafficRpsContext);
}
