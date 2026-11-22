"use client";

import { DEFAULT_CDN_CACHE_HIT_RATIO_PERCENT } from "../traffic-rps";
import type { SelectedElementInfo } from "../types";
import { computeCdnCost } from "../usage-based-cost";

/**
 * F4: CDN(CloudFront) 전용 인스펙터 — 캐시 적중률만 입력받고, 나머지(요청 수·전송량)는 트래픽
 * 전파 엔진이 계산한 RPS와 USER(입구) 노드의 평균 응답 크기로 자동 계산한다. 캐시 적중률은 이
 * 비용 자체에는 영향이 없고(뷰어에게는 어차피 다 응답해야 하니까) origin으로 가는 트래픽만
 * 줄인다 — 그래서 아래 비용 계산에는 쓰이지 않고, traffic-rps.ts의 전파 계산에만 쓰인다.
 */
export function CdnInspectorSection({
  elementInfo,
  onUpdateUsageBasedCostSettings,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateUsageBasedCostSettings: (nodeId: string, patch: { cdnCacheHitRatioPercent?: number }) => void;
}) {
  const rps = elementInfo.computedRps;
  const avgResponseSizeKb = elementInfo.entryAvgResponseSizeKb;
  const cost = rps !== undefined && avgResponseSizeKb !== undefined ? computeCdnCost({ rps, avgResponseSizeKb }) : null;
  const isDefaultHitRatio = elementInfo.cdnCacheHitRatioPercent === undefined;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">CDN 비용</p>
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            캐시 적중률
            {isDefaultHitRatio && (
              <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                기본값
              </span>
            )}
          </span>
          <span className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={elementInfo.cdnCacheHitRatioPercent ?? DEFAULT_CDN_CACHE_HIT_RATIO_PERCENT}
              onChange={(event) =>
                onUpdateUsageBasedCostSettings(elementInfo.id, {
                  cdnCacheHitRatioPercent: event.target.value === "" ? undefined : Number(event.target.value),
                })
              }
              className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            %
          </span>
        </label>

        {rps === undefined ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">이 노드로 들어오는 트래픽 경로가 없어서 비용을 계산할 수 없어요.</p>
        ) : avgResponseSizeKb === undefined ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            입구(USER) 노드에 &ldquo;평균 응답 크기&rdquo;를 입력하면 비용을 계산할 수 있어요.
          </p>
        ) : (
          cost && (
            <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-xs dark:border-gray-800">
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span>월 요청 수</span>
                <span>{Math.round(cost.monthlyRequests).toLocaleString()}건</span>
              </div>
              <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
                <span>월 전송량</span>
                <span>{cost.monthlyTransferGb.toFixed(1)}GB</span>
              </div>
              <div className="flex items-center justify-between font-medium text-gray-700 dark:text-gray-200">
                <span>요청 비용</span>
                <span>${cost.requestCostUsd.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between font-medium text-gray-700 dark:text-gray-200">
                <span>전송 비용</span>
                <span>${cost.transferCostUsd.toFixed(2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-100">
                <span>월 예상 비용</span>
                <span>${cost.monthlyCostUsd.toFixed(2)}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                대한민국 포함 요금 구간 기준(종량제, 정액 요금제 제외)이에요.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
