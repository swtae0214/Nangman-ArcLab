"use client";

import type { SelectedElementInfo } from "../types";

/** App Runner 자체 오토스케일링 설정의 기본 최소 인스턴스 수(AWS 콘솔 기본값). */
const DEFAULT_APP_RUNNER_MIN_INSTANCE_COUNT = 1;

/**
 * 13단계: APP_RUNNER 전용 인스펙터. App Runner는 ECS/Elastic Beanstalk처럼 "인스턴스 노드를
 * 여러 개 그려서 ASG로 묶는" 방식이 아니라(그런 EC2 Auto Scaling Group 자체가 없다), 서비스
 * 하나당 박스 하나만 그리고 이 숫자로 최소 용량을 나타낸다 — 실제 AWS 콘솔의 min size 설정과 같다.
 */
export function AppRunnerInspectorSection({
  elementInfo,
  onUpdateRedundancySettings,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateRedundancySettings: (nodeId: string, patch: { appRunnerMinInstanceCount?: number }) => void;
}) {
  const isDefault = elementInfo.appRunnerMinInstanceCount === undefined;
  const minInstanceCount = elementInfo.appRunnerMinInstanceCount ?? DEFAULT_APP_RUNNER_MIN_INSTANCE_COUNT;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">이중화</p>
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5">
            최소 인스턴스 수
            {isDefault && (
              <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                기본값
              </span>
            )}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={minInstanceCount}
            onChange={(event) => {
              const next = Number(event.target.value);
              onUpdateRedundancySettings(elementInfo.id, {
                appRunnerMinInstanceCount: Number.isFinite(next) && next >= 1 ? next : 1,
              });
            }}
            className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          App Runner 자체 오토스케일링 설정의 최소 인스턴스 수예요(EC2 Auto Scaling Group이 아니에요).
        </p>
      </div>
    </div>
  );
}
