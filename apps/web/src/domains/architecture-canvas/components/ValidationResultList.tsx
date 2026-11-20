"use client";

import type { ArchitectureValidationReport, ValidationRuleResult } from "@nangman/shared-types";
import { SEVERITY_DOT_STYLE, SEVERITY_LABEL, SEVERITY_ORDER, SEVERITY_STYLE } from "../validation-style";

interface ValidationResultListProps {
  report: ArchitectureValidationReport;
  /** 마지막으로 검증을 실행한 시각(react-query의 dataUpdatedAt) — "방금 전 검증" 같은 문구에 쓴다. */
  checkedAt?: number;
  /** "캔버스에서 보기"를 누르면 그 규칙이 지목한 노드들을 선택하고 화면에 맞춰 보여준다. */
  onFocusNodes?: (nodeIds: string[]) => void;
  /** 하단 "다음으로 실험해보기" 버튼 — 지금은 시뮬레이션 탭으로만 이동시킨다(구체적인 시나리오 자동 실행 연결은 추후 작업). */
  onGoToExperiment?: () => void;
}

function formatElapsed(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}시간 전`;
}

function ValidationItem({
  result,
  onFocusNodes,
}: {
  result: ValidationRuleResult;
  onFocusNodes?: (nodeIds: string[]) => void;
}) {
  const nodeIds = result.detail.nodeIds ?? [];
  return (
    <details
      className={`group rounded-md border px-3 py-2 text-sm ${
        !result.applicable
          ? "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-500"
          : result.passed
            ? "border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            : SEVERITY_STYLE[result.severity]
      }`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="text-[10px] transition-transform group-open:rotate-90">▶</span>
          {result.applicable ? (result.passed ? "✅" : "⚠️") : "➖"} {result.name}
        </span>
        {result.applicable ? (
          <span className="text-xs uppercase text-gray-400 dark:text-gray-500">{result.severity}</span>
        ) : (
          <span className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-gray-600 dark:text-gray-500">
            해당 없음
          </span>
        )}
      </summary>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {result.applicable ? result.description : "이 규칙이 다루는 컴포넌트가 캔버스에 없어서, 검사할 대상이 없어요."}
      </p>
      <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">근거: {result.sourceCitation}</p>
      {result.applicable && !result.passed && nodeIds.length > 0 && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[11px] text-red-500 dark:text-red-400">문제 노드 {nodeIds.length}개</p>
          {onFocusNodes && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                onFocusNodes(nodeIds);
              }}
              className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
            >
              ◇ 캔버스에서 보기
            </button>
          )}
        </div>
      )}
    </details>
  );
}

export function ValidationResultList({ report, checkedAt, onFocusNodes, onGoToExperiment }: ValidationResultListProps) {
  const applicableResults = report.results.filter((result) => result.applicable);
  const failedCount = applicableResults.filter((result) => !result.passed).length;
  const checkedLabel = checkedAt ? ` · ${formatElapsed(checkedAt)} 검증` : "";

  const groups = SEVERITY_ORDER.map((severity) => ({
    severity,
    results: report.results.filter((result) => result.severity === severity),
  })).filter((group) => group.results.length > 0);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <div
        className={`rounded-md border px-3 py-2 text-sm ${
          report.passed
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        <p className="font-semibold">{report.passed ? "✅ 검증 통과" : "⚠️ 검증 실패"}</p>
        <p className="mt-0.5 text-xs opacity-80">
          {report.passed
            ? `${applicableResults.length}개 규칙을 모두 충족했어요${checkedLabel}`
            : `${failedCount}개 규칙을 충족하지 못했어요${checkedLabel}`}
        </p>
      </div>
      {groups.map((group) => (
        <div key={group.severity} className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT_STYLE[group.severity]}`} />
            {SEVERITY_LABEL[group.severity]} · 규칙 {group.results.length}개
          </p>
          <ul className="flex flex-col gap-2">
            {group.results.map((result) => (
              <li key={result.ruleCode}>
                <ValidationItem result={result} onFocusNodes={onFocusNodes} />
              </li>
            ))}
          </ul>
        </div>
      ))}
      {onGoToExperiment && (
        <div className="flex flex-col gap-1.5 border-t border-gray-200 pt-3 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">다음으로 실험해 보기</p>
          <button
            type="button"
            onClick={onGoToExperiment}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-left text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            ⚡ AZ 장애 주입해보기
          </button>
          <button
            type="button"
            onClick={onGoToExperiment}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            ↗ 트래픽 2배로 늘려 보기
          </button>
        </div>
      )}
    </div>
  );
}
