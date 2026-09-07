"use client";

import { createContext, useContext } from "react";

const EMPTY_PROBLEM_NODE_IDS: ReadonlySet<string> = new Set();

/**
 * 검증 리포트에서 실패한 규칙들이 지목한 노드 id 모음을 캔버스 노드 렌더러(LeafNode/GroupNode)에
 * 전달하는 통로. node.data에 직접 끼워 넣으면 저장되는 그래프 JSON까지 오염되므로,
 * 저장과 무관한 "현재 세션의 검증 표시"는 별도 Context로 흘려보낸다.
 */
const ProblemNodesContext = createContext<ReadonlySet<string>>(EMPTY_PROBLEM_NODE_IDS);

export const ProblemNodesProvider = ProblemNodesContext.Provider;

export function useProblemNodeIds(): ReadonlySet<string> {
  return useContext(ProblemNodesContext);
}
