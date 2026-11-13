"use client";

import type { ArchitectureValidationReport, RuleSeverity } from "@nangman/shared-types";

const SEVERITY_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  WARNING: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  INFO: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export function ValidationResultList({ report }: { report: ArchitectureValidationReport }) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <div
        className={`rounded-md border px-3 py-2 text-sm font-semibold ${
          report.passed
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
            : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
        }`}
      >
        {report.passed ? "치명적인(Critical) 문제는 없어요" : "치명적인(Critical) 문제가 발견됐어요"}
      </div>
      <ul className="flex flex-col gap-2">
        {report.results.map((result) => (
          <li key={result.ruleCode}>
            {/* 10단계: 제목만 보이고 눌러야 설명/근거가 펼쳐지게 — 규칙이 많아지면 제목만 있어도 전체 목록이 한눈에 들어온다. */}
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
              {result.applicable && !result.passed && result.detail.nodeIds && result.detail.nodeIds.length > 0 && (
                <p className="mt-1 text-[11px] text-red-500 dark:text-red-400">
                  문제 노드 {result.detail.nodeIds.length}개 — 캔버스에서 빨간 테두리로 표시됩니다.
                </p>
              )}
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
