"use client";

import type { SelectedElementInfo } from "../types";
import { computeAlbCost } from "../usage-based-cost";

/**
 * F4: LOAD_BALANCER(ALB) 전용 인스펙터. LCU는 "신규 연결/활성 연결/처리 데이터/규칙 평가" 4가지
 * 차원 중 가장 큰 값으로 매겨지는데, 신규 연결 차원만 RPS에서 바로(검증된 가정 없이) 유도할 수
 * 있어서 그것만 계산한다 — 나머지 차원은 연결 유지시간 같은 검증 안 된 평균치가 필요해 2026-11에
 * 범위에서 뺐다(성우와 상의해 결정). 그래서 실제 청구액은 이 값보다 클 수 있다.
 */
export function LoadBalancerInspectorSection({
  elementInfo,
  onUpdateUsageBasedCostSettings,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateUsageBasedCostSettings: (nodeId: string, patch: { albConnectionReuse?: boolean; albRequestsPerConnection?: number }) => void;
}) {
  const rps = elementInfo.computedRps;
  const connectionReuse = elementInfo.albConnectionReuse ?? true;
  const cost =
    rps !== undefined
      ? computeAlbCost({ rps, connectionReuse, requestsPerConnection: elementInfo.albRequestsPerConnection })
      : null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">로드밸런서 비용</p>
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          연결을 재사용하나요?
          <select
            value={connectionReuse ? "yes" : "no"}
            onChange={(event) => onUpdateUsageBasedCostSettings(elementInfo.id, { albConnectionReuse: event.target.value === "yes" })}
            className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="yes">예 (keep-alive)</option>
            <option value="no">아니오 (매번 새 연결)</option>
          </select>
        </label>

        {connectionReuse && (
          <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
            연결당 평균 요청 수
            <input
              type="number"
              min={1}
              step="any"
              value={elementInfo.albRequestsPerConnection ?? ""}
              onChange={(event) =>
                onUpdateUsageBasedCostSettings(elementInfo.id, {
                  albRequestsPerConnection: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
              className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
        )}

        {rps === undefined ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">이 노드로 들어오는 트래픽 경로가 없어서 비용을 계산할 수 없어요.</p>
        ) : !cost ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">연결당 평균 요청 수를 입력하면 비용을 계산할 수 있어요.</p>
        ) : (
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-xs dark:border-gray-800">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span>신규 연결(초당)</span>
              <span>{cost.newConnectionsPerSec.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span>LCU(신규 연결 기준)</span>
              <span>{cost.lcuFromNewConnections.toFixed(3)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-100">
              <span>월 예상 비용</span>
              <span>${cost.monthlyCostUsd.toFixed(2)}</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              활성 연결·처리 데이터·규칙 평가 차원은 반영되지 않았어요 — 실제 비용은 이보다 높을 수 있어요.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
