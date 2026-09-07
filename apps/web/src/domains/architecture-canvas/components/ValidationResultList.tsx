"use client";

import type { ArchitectureValidationReport, RuleSeverity } from "@nangman/shared-types";

const SEVERITY_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-700",
  WARNING: "border-amber-300 bg-amber-50 text-amber-700",
  INFO: "border-blue-300 bg-blue-50 text-blue-700",
};

export function ValidationResultList({ report }: { report: ArchitectureValidationReport }) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      <div
        className={`rounded-md border px-3 py-2 text-sm font-semibold ${
          report.passed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-red-300 bg-red-50 text-red-700"
        }`}
      >
        {report.passed ? "치명적인(Critical) 문제는 없어요" : "치명적인(Critical) 문제가 발견됐어요"}
      </div>
      <ul className="flex flex-col gap-2">
        {report.results.map((result) => (
          <li
            key={result.ruleCode}
            className={`rounded-md border px-3 py-2 text-sm ${result.passed ? "border-gray-200 bg-white" : SEVERITY_STYLE[result.severity]}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">
                {result.passed ? "✅" : "⚠️"} {result.name}
              </span>
              <span className="text-xs uppercase text-gray-400">{result.severity}</span>
            </div>
            <p className="mt-1 text-xs text-gray-500">{result.description}</p>
            <p className="mt-1 text-[11px] text-gray-400">근거: {result.sourceCitation}</p>
            {!result.passed && result.detail.nodeIds && result.detail.nodeIds.length > 0 && (
              <p className="mt-1 text-[11px] text-red-500">문제 노드 {result.detail.nodeIds.length}개 — 캔버스에서 빨간 테두리로 표시됩니다.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
