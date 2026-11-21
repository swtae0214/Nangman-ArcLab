"use client";

import { useEffect } from "react";
import { useComponentPresets, useNodeCapacityPreview } from "../hooks/useCapacityCalculator";
import type { SelectedElementInfo } from "../types";

const DEBOUNCE_MS = 300;

function formatLatency(ms: number | null): string {
  return ms === null ? "계산 불가(포화)" : `${ms.toFixed(1)}ms`;
}

/**
 * F4: "용량 계산기" 탭의 수동 입력 폼을 노드 인스펙터 안으로 가져온 버전 — 프리셋·인스턴스 수는
 * 이 노드에 이미 저장된 값을 그대로 쓰고, 예상 RPS는 트래픽 전파 엔진이 계산한 값(computedRps)을
 * 자동으로 넣어준다. M/M/c 계산 자체는 서버의 calculateMMc를 그대로 재사용한다(프론트에 다시
 * 구현하면 두 계산이 미세하게 어긋날 위험이 있어서, 입력이 바뀔 때마다 그 계산 API를 다시 부른다).
 */
export function CapacityInspectorSection({
  elementInfo,
  onUpdateCapacitySettings,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateCapacitySettings: (nodeId: string, patch: { instanceCount?: number }) => void;
}) {
  const presetsQuery = useComponentPresets();
  const preview = useNodeCapacityPreview();
  const preset = presetsQuery.data?.find((candidate) => candidate.code === elementInfo.presetCode);
  const instanceCount = elementInfo.instanceCount ?? 1;
  const expectedRps = elementInfo.computedRps;

  useEffect(() => {
    if (!elementInfo.presetCode || expectedRps === undefined) return;
    const timer = setTimeout(() => {
      preview.mutate({ presetCode: elementInfo.presetCode!, instanceCount, expectedRps });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- preview(mutation 객체)는 매 렌더 새 참조라 deps에 넣으면 무한 재실행된다.
  }, [elementInfo.presetCode, instanceCount, expectedRps]);

  if (!elementInfo.presetCode) {
    return (
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">용량 · 비용</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">캔버스에서 프리셋을 먼저 골라주세요.</p>
      </div>
    );
  }

  const monthlyCostUsd = preset?.monthlyCostUsd !== undefined ? preset.monthlyCostUsd * instanceCount : undefined;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">용량 · 비용</p>
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          인스턴스 수
          <input
            type="number"
            min={1}
            step={1}
            value={instanceCount}
            onChange={(event) => {
              const next = Number(event.target.value);
              onUpdateCapacitySettings(elementInfo.id, { instanceCount: Number.isFinite(next) && next >= 1 ? next : 1 });
            }}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          대
        </label>

        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>요청 수(자동)</span>
          <span>{expectedRps !== undefined ? `${expectedRps.toFixed(1)} RPS` : "트래픽 경로 없음"}</span>
        </div>

        {preview.data && (
          <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-xs dark:border-gray-800">
            <div
              className={
                preview.data.isSaturated
                  ? "font-semibold text-red-600 dark:text-red-400"
                  : "font-semibold text-emerald-600 dark:text-emerald-400"
              }
            >
              {preview.data.isSaturated ? "⚠️ 처리 능력을 초과했어요 (포화 상태)" : "정상 처리 가능"}
            </div>
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span>처리 한계({instanceCount}대 합산)</span>
              <span>{preview.data.muRps.toFixed(0)} RPS</span>
            </div>
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span>이용률(ρ)</span>
              <span>{(preview.data.rho * 100).toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span>평균 지연시간</span>
              <span>{formatLatency(preview.data.avgLatencyMs)}</span>
            </div>
          </div>
        )}

        {monthlyCostUsd !== undefined && (
          <div className="mt-1 flex items-center justify-between border-t border-gray-100 pt-1 text-xs font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-100">
            <span>월 예상 비용({instanceCount}대)</span>
            <span>${monthlyCostUsd.toFixed(2)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
