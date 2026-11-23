"use client";

import { createContext, useContext } from "react";

const EMPTY_IAM_BLOCKED_COUNT_BY_NODE_ID: ReadonlyMap<string, number> = new Map();

/**
 * 14단계: IAM 노드 위 "▲ 차단 N" 배지용 — traffic-rps-context와 같은 패턴으로, 저장되는 그래프
 * JSON과 무관한 "현재 그래프 기준 파생 상태"를 node.data가 아닌 별도 Context로 흘려보낸다.
 * "트래픽 흐름 보기" 토글과 무관하게 항상 값이 내려간다(마스터 스위치로 꺼둔 상태를 패널을
 * 안 열어도 계속 알 수 있어야 해서).
 */
const IamBlockedCountContext = createContext<ReadonlyMap<string, number>>(EMPTY_IAM_BLOCKED_COUNT_BY_NODE_ID);

export const IamBlockedCountProvider = IamBlockedCountContext.Provider;

export function useIamBlockedCountByNodeId(): ReadonlyMap<string, number> {
  return useContext(IamBlockedCountContext);
}
