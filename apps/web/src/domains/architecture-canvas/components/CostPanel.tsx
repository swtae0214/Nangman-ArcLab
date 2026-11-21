"use client";

import { COMPONENT_META } from "../component-meta";
import type { ArchitectureCostSummary } from "../node-cost";

/**
 * "예상 비용" 탭 — 트래픽 전파 엔진이 아니라 ArchitectureCanvas가 보내주는 집계 결과(F1)만 그린다.
 * 노드별 월 비용은 프리셋표에서 바로 찾은 값이라, 캔버스 쪽(ArchitectureCanvas)에서 한 번만
 * 계산해 올려보내고(onCostSummaryChange), 이 패널은 받은 값을 보여주기만 한다.
 */
export function CostPanel({ summary }: { summary: ArchitectureCostSummary | null }) {
  if (!summary || summary.lines.length === 0) {
    return (
      <p className="p-3 text-xs text-gray-400 dark:text-gray-500">
        아직 비용을 추정할 수 있는 컴포넌트(웹 서버/DB/캐시/로드밸런서/CDN)가 없어요.
      </p>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 dark:bg-gray-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        각 컴포넌트에 고른 프리셋의 AWS 온디맨드 요금(us-east-1)을 기준으로 어림잡은 월간 비용이에요.
        실제 트래픽·할인·예약 인스턴스 등은 반영되지 않은 교육용 추정치예요.
      </p>

      <ul className="flex flex-col gap-1.5">
        {summary.lines.map((line) => (
          <li
            key={line.nodeId}
            className="flex items-center justify-between gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-800 dark:text-gray-100">{line.label}</p>
              <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                {line.presetDisplayName ?? COMPONENT_META[line.type].label}
              </p>
            </div>
            {line.monthlyCostUsd !== undefined ? (
              <span className="shrink-0 font-medium text-gray-700 dark:text-gray-200">월 ${line.monthlyCostUsd.toFixed(2)}</span>
            ) : (
              <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                가격 미지원
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-gray-200 pt-2 text-sm dark:border-gray-700">
        <span className="font-semibold text-gray-800 dark:text-gray-100">월 예상 비용 합계</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">${summary.totalMonthlyCostUsd.toFixed(2)}</span>
      </div>
      {summary.unresolvedCount > 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          가격 미지원 {summary.unresolvedCount}개는 합계에서 빠져 있어요 (프리셋 미지정, 또는 로드밸런서·CDN처럼 아직 가격
          데이터가 없는 타입).
        </p>
      )}
    </div>
  );
}
