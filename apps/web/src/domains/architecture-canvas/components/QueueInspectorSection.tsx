"use client";

import type { SelectedElementInfo } from "../types";

/**
 * 13단계: SQS/Kinesis Data Streams 전용 인스펙터. 트래픽 전파 엔진이 계산한 유입 RPS(computedRps)는
 * 자동으로 보여주고, 컨슈머가 처리할 수 있는 양만 직접 입력받는다 — QUEUE-001이 이 둘을 비교해서
 * 유입이 더 빠르면(컨슈머가 못 따라가면) 적체 위험을 경고한다. 처리 능력을 안 정했으면 비교할 기준이
 * 없어서 "모르는 걸 위반으로 단정하지 않는다"는 원칙대로 판정에서 빠진다(= 기본값을 임의로 안 채운다).
 */
export function QueueInspectorSection({
  elementInfo,
  onUpdateQueueSettings,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateQueueSettings: (nodeId: string, patch: { queueConsumerThroughputRps?: number }) => void;
}) {
  const incomingRps = elementInfo.computedRps;
  const capacity = elementInfo.queueConsumerThroughputRps;
  const isOverCapacity = incomingRps !== undefined && capacity !== undefined && incomingRps > capacity;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">적체 위험</p>
      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>유입 속도(자동)</span>
          <span>{incomingRps !== undefined ? `${incomingRps.toFixed(1)} RPS` : "트래픽 경로 없음"}</span>
        </div>

        <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
          컨슈머 처리 능력
          <input
            type="number"
            min={0}
            step="any"
            value={capacity ?? ""}
            onChange={(event) =>
              onUpdateQueueSettings(elementInfo.id, {
                queueConsumerThroughputRps: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
            placeholder="초당 메시지 수"
            className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
        </label>

        {capacity === undefined ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">
            컨슈머 처리 능력을 입력하면 적체 위험을 계산할 수 있어요.
          </p>
        ) : (
          <div
            className={`mt-1 border-t pt-2 text-xs font-semibold ${
              isOverCapacity
                ? "border-gray-100 text-red-600 dark:border-gray-800 dark:text-red-400"
                : "border-gray-100 text-emerald-600 dark:border-gray-800 dark:text-emerald-400"
            }`}
          >
            {isOverCapacity ? "⚠️ 유입 속도가 처리 능력을 넘어요 — 메시지가 쌓일 수 있어요" : "정상 처리 가능"}
          </div>
        )}
      </div>
    </div>
  );
}
