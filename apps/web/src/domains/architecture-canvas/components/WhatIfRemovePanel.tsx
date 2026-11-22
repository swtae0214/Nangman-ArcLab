"use client";

import type { ArchitectureGraph, ValidationRuleResult } from "@nangman/shared-types";
import { useValidationPreview } from "../hooks/useValidation";

/** 선택한 노드와 거기 붙은 선만 뺀 가상 그래프 — 실제 저장되는 그래프는 전혀 건드리지 않는다. */
function removeNode(graph: ArchitectureGraph, nodeId: string): ArchitectureGraph {
  return {
    nodes: graph.nodes.filter((node) => node.id !== nodeId),
    edges: graph.edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
  };
}

/** before/after 두 검증 결과에서 통과 여부가 바뀐 규칙만 추려낸다 — 바뀐 것만 보여줘야 "무엇이 깨지는지"가 한눈에 보인다. */
function diffValidationResults(
  before: ValidationRuleResult[],
  after: ValidationRuleResult[],
): { ruleCode: string; name: string; beforePassed: boolean; afterPassed: boolean }[] {
  const afterByCode = new Map(after.map((result) => [result.ruleCode, result]));
  const diffs: { ruleCode: string; name: string; beforePassed: boolean; afterPassed: boolean }[] = [];
  for (const beforeResult of before) {
    const afterResult = afterByCode.get(beforeResult.ruleCode);
    if (!afterResult) continue;
    if (beforeResult.passed !== afterResult.passed) {
      diffs.push({ ruleCode: beforeResult.ruleCode, name: beforeResult.name, beforePassed: beforeResult.passed, afterPassed: afterResult.passed });
    }
  }
  return diffs;
}

/**
 * F3: "빼고 시험해 보기" — 이 노드가 없으면 비용이 얼마나 줄고, 어떤 검증 규칙이 깨지는지 저장 없이
 * 미리 보여준다. before(현재 그래프 그대로)/after(이 노드를 뺀 그래프) 두 번을 한 번에 미리보기
 * API로 보내서 비교한다 — "검증 실행"을 안 눌러도, 또 그 결과가 오래됐어도 항상 정확하다.
 */
export function WhatIfRemovePanel({
  architectureId,
  graph,
  nodeId,
  nodeLabel,
}: {
  architectureId: string;
  graph: ArchitectureGraph;
  nodeId: string;
  nodeLabel: string;
}) {
  const beforePreview = useValidationPreview(architectureId);
  const afterPreview = useValidationPreview(architectureId);

  const handleTry = () => {
    beforePreview.mutate(graph);
    afterPreview.mutate(removeNode(graph, nodeId));
  };

  const handleReset = () => {
    beforePreview.reset();
    afterPreview.reset();
  };

  const isPending = beforePreview.isPending || afterPreview.isPending;
  const hasResult = beforePreview.data && afterPreview.data;

  return (
    <div className="flex flex-col gap-2">
      {/* B8: 다른 실험 버튼들(장애 주입/트래픽 2배)과 같은 파란 스타일로 통일 — 노란 버튼은 없앴다. */}
      <button
        type="button"
        onClick={hasResult ? handleReset : handleTry}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-40 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-950"
      >
        {isPending ? "계산 중..." : hasResult ? "✕ 결과 닫기" : `🗑 "${nodeLabel}" 빼고 시험해 보기`}
      </button>

      {/* 규칙 5: 실제 그래프가 아니라 "가상으로 빼봤을 때"의 실험 상태라서, 주황(#B54708) + 점선
          테두리로 "이건 실제 상태가 아니다"를 색과 테두리 모양 둘 다로 보여준다. */}
      {hasResult && beforePreview.data && afterPreview.data && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-dashed p-3 text-xs"
          style={{ borderColor: "#B54708", backgroundColor: "rgba(181,71,8,0.06)" }}
        >
          <div className="flex items-center justify-between">
            <span className="text-gray-500 dark:text-gray-400">월 예상 비용</span>
            <span className="font-medium text-gray-800 dark:text-gray-100">
              ${beforePreview.data.estimatedMonthlyCostUsd.toFixed(2)} → ${afterPreview.data.estimatedMonthlyCostUsd.toFixed(2)}{" "}
              <span className="text-emerald-600 dark:text-emerald-400">
                ({afterPreview.data.estimatedMonthlyCostUsd - beforePreview.data.estimatedMonthlyCostUsd <= 0 ? "" : "+"}
                ${(afterPreview.data.estimatedMonthlyCostUsd - beforePreview.data.estimatedMonthlyCostUsd).toFixed(2)})
              </span>
            </span>
          </div>

          {(() => {
            const diffs = diffValidationResults(beforePreview.data.validation.results, afterPreview.data.validation.results);
            if (diffs.length === 0) {
              return <p className="text-gray-500 dark:text-gray-400">검증 결과는 바뀌지 않아요.</p>;
            }
            return (
              <div className="flex flex-col gap-1">
                <p className="text-gray-500 dark:text-gray-400">바뀌는 검증 결과</p>
                {diffs.map((diff) => (
                  <div key={diff.ruleCode} className="flex items-center justify-between gap-2">
                    <span className="text-gray-700 dark:text-gray-200">{diff.name}</span>
                    <span>
                      <span className={diff.beforePassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {diff.beforePassed ? "✓ 통과" : "⚠ 실패"}
                      </span>
                      {" → "}
                      <span className={diff.afterPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                        {diff.afterPassed ? "✓ 통과" : "⚠ 실패"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}

          <p className="text-[11px] text-gray-400 dark:text-gray-500">실제 아키텍처는 바뀌지 않아요 — 미리보기일 뿐이에요.</p>
        </div>
      )}

      {(beforePreview.error || afterPreview.error) && (
        <p className="text-xs text-red-600 dark:text-red-400">{(beforePreview.error ?? afterPreview.error)?.message}</p>
      )}
    </div>
  );
}
