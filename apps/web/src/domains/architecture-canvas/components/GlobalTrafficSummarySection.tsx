"use client";

import type { ArchitectureGraph, ComponentType } from "@nangman/shared-types";
import { useMemo } from "react";
import { COMPONENT_META } from "../component-meta";
import { computeNodeRps } from "../traffic-rps";
import { KB_PER_GB, SECONDS_PER_MONTH } from "../usage-based-cost";

/**
 * F4: USER(입구) 노드를 선택했을 때 보여주는 "전체 트래픽" 요약 — 입구 하나의 평균 RPS/응답
 * 크기가 그래프 전체로 어떻게 퍼져나가는지 한눈에 보여준다. 트래픽 전파 엔진(computeNodeRps)을
 * 이 컴포넌트 안에서 다시 돌리는 이유는, 선택된 요소(USER) 하나의 RPS만 올라오는 elementInfo와
 * 달리 "모든 노드"의 RPS가 필요해서다 — graph는 F3도 같은 이유로 이미 통째로 받고 있다.
 */
export function GlobalTrafficSummarySection({ graph }: { graph: ArchitectureGraph }) {
  const { rpsByNodeId, order } = useMemo(() => computeNodeRps(graph), [graph]);

  const groupsByType = useMemo(() => {
    const rankByNodeId = new Map(order.map((id, index) => [id, index]));
    const relevantNodes = graph.nodes.filter((node) => !COMPONENT_META[node.type].isGroup && node.type !== "TEXT_BOX");

    const nodesByType = new Map<ComponentType, typeof relevantNodes>();
    for (const node of relevantNodes) {
      const list = nodesByType.get(node.type) ?? [];
      list.push(node);
      nodesByType.set(node.type, list);
    }

    return Array.from(nodesByType.entries())
      .map(([type, typeNodes]) => ({
        type,
        label: COMPONENT_META[type].label,
        values: typeNodes.map((node) => rpsByNodeId.get(node.id) ?? 0),
        minRank: Math.min(...typeNodes.map((node) => rankByNodeId.get(node.id) ?? Infinity)),
      }))
      .sort((a, b) => a.minRank - b.minRank);
  }, [graph.nodes, rpsByNodeId, order]);

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray-200 p-3 text-xs dark:border-gray-700">
      <p className="font-medium text-gray-600 dark:text-gray-300">값이 흘러가는 모습</p>
      {groupsByType.map((group) => (
        <div key={group.type} className="flex items-center justify-between gap-2 text-gray-500 dark:text-gray-400">
          <span>
            {group.label}
            {group.values.length > 1 && ` ×${group.values.length}`}
          </span>
          <span className="text-gray-700 dark:text-gray-200">{group.values.map((value) => Math.round(value)).join(" + ")}</span>
        </div>
      ))}
    </div>
  );
}

/** "전체 트래픽" 패널의 월 요청 수/전송량 — USER 섹션이 평균 RPS·응답 크기 입력 바로 아래에 보여준다. */
export function computeGlobalMonthlyFigures(entryAvgRps: number, entryAvgResponseSizeKb?: number) {
  const monthlyRequests = entryAvgRps * SECONDS_PER_MONTH;
  const monthlyTransferGb =
    entryAvgResponseSizeKb !== undefined ? (entryAvgRps * entryAvgResponseSizeKb * SECONDS_PER_MONTH) / KB_PER_GB : undefined;
  return { monthlyRequests, monthlyTransferGb };
}
