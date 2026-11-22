"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SimulationRunSummary } from "@nangman/shared-types";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useFailureScenarios, useRunSimulation, useSimulationRuns } from "../hooks/useSimulation";

const SECONDS_PER_DAY = 86_400;
const MAX_COMPARE_SELECTION = 2;

function formatRunTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const formSchema = z.object({
  targetAvailability: z.number().min(0).max(100),
  failureScenarioCode: z.string(),
  observationPeriodSec: z.number().int().min(1),
});

type FormValues = z.infer<typeof formSchema>;

function formatLatency(ms: number | null): string {
  return ms === null ? "계산 불가(포화)" : `${ms.toFixed(1)}ms`;
}

/**
 * 5단계 핵심 화면: 요구사항을 입력하면 검증(3단계) + 큐잉 계산(4단계) + 장애 주입을 한 번에 실행한다.
 * (원래 설계된 "RequirementForm"을 4주차엔 미뤘던 걸 여기서 실제로 만든다.)
 */
export function SimulationPanel({
  architectureId,
  entryAvgRps,
  entryUserNodeId,
  onFocusNodes,
}: {
  architectureId: string;
  /** F8(A3): 사용자(USER) 노드의 평균 RPS — 트래픽 입력의 단일 출처. 여기서는 읽기 전용으로만 쓴다. */
  entryAvgRps?: number;
  entryUserNodeId?: string;
  onFocusNodes: (nodeIds: string[]) => void;
}) {
  const failureScenariosQuery = useFailureScenarios();
  const runSimulation = useRunSimulation(architectureId);
  const runsQuery = useSimulationRuns(architectureId);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds((prev) => {
      if (prev.includes(runId)) return prev.filter((id) => id !== runId);
      // F2: 3개 이상 고르면 비교 표가 복잡해져서, 가장 먼저 고른 것부터 밀어내고 항상 최대 2개만 유지한다.
      const next = [...prev, runId];
      return next.length > MAX_COMPARE_SELECTION ? next.slice(next.length - MAX_COMPARE_SELECTION) : next;
    });
  };
  const selectedRuns = selectedRunIds
    .map((runId) => runsQuery.data?.find((run) => run.id === runId))
    .filter((run): run is SimulationRunSummary => run !== undefined);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetAvailability: 99.9,
      failureScenarioCode: "",
      observationPeriodSec: 30 * SECONDS_PER_DAY,
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (entryAvgRps === undefined) return;
    runSimulation.mutate({
      targetAvailability: values.targetAvailability,
      expectedRps: entryAvgRps,
      observationPeriodSec: values.observationPeriodSec,
      ...(values.failureScenarioCode ? { failureScenarioCode: values.failureScenarioCode } : {}),
    });
  });

  const result = runSimulation.data;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 dark:bg-gray-900">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        요구사항을 입력하면 정적 검증 + 노드별 M/M/c 계산 + (선택 시) 장애 주입까지 한 번에 실행해요.
      </p>

      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          목표 가용성 (%)
          <input
            type="number"
            min={0}
            max={100}
            step="any"
            {...register("targetAvailability", { valueAsNumber: true })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          {errors.targetAvailability && (
            <span className="mt-0.5 block text-[11px] text-red-500 dark:text-red-400">{errors.targetAvailability.message}</span>
          )}
        </label>

        {/* F8(A3): 트래픽 입력의 단일 출처는 사용자(USER) 노드라서, 여기서는 그 값을 읽기만 하고
            "사용자 노드에서 수정" 링크만 제공한다 — 이 탭만의 별도 RPS 입력은 두지 않는다. */}
        <div className="rounded border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700">
          <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
            <span className="font-medium">예상 RPS</span>
            <span className={entryAvgRps === undefined ? "text-red-500 dark:text-red-400" : "text-gray-800 dark:text-gray-100"}>
              {entryAvgRps ?? "미입력"} {entryAvgRps !== undefined && "RPS"}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            사용자 노드에서 가져와요.{" "}
            {entryUserNodeId && (
              <button
                type="button"
                onClick={() => onFocusNodes([entryUserNodeId])}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                사용자 노드에서 수정
              </button>
            )}
          </p>
        </div>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          장애 시나리오 (선택)
          <select
            {...register("failureScenarioCode")}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="">없음 (평상시만 계산)</option>
            {failureScenariosQuery.data?.map((scenario) => (
              <option key={scenario.code} value={scenario.code}>
                {scenario.displayName}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          관찰 기간 (초)
          <input
            type="number"
            min={1}
            {...register("observationPeriodSec", { valueAsNumber: true })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          <span className="mt-0.5 block text-[11px] text-gray-400 dark:text-gray-500">기본값은 30일(2,592,000초)이에요.</span>
          {errors.observationPeriodSec && (
            <span className="mt-0.5 block text-[11px] text-red-500 dark:text-red-400">{errors.observationPeriodSec.message}</span>
          )}
        </label>

        <button
          type="submit"
          disabled={runSimulation.isPending || entryAvgRps === undefined}
          title={entryAvgRps === undefined ? "사용자 노드에 평균 요청 수를 먼저 입력하세요" : undefined}
          className="mt-1 rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
        >
          {runSimulation.isPending ? "실행 중..." : "시뮬레이션 실행"}
        </button>
      </form>

      {runSimulation.error && <p className="text-xs text-red-600 dark:text-red-400">{runSimulation.error.message}</p>}

      {result && (
        <div className="flex flex-col gap-2">
          <div
            className={`rounded-md border p-3 text-sm font-semibold ${
              result.estimatedAvailabilityPercent >= result.input.targetAvailability
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            }`}
          >
            추정 가용성 {result.estimatedAvailabilityPercent.toFixed(3)}% (목표 {result.input.targetAvailability}%)
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-gray-200 p-2 text-xs dark:border-gray-700 dark:text-gray-200">
              <p className="mb-1 font-semibold text-gray-700 dark:text-gray-200">평상시</p>
              <p>종단 지연: {formatLatency(result.baseline.endToEndLatencyMs)}</p>
              <p>처리량: {result.baseline.throughputRps.toFixed(1)} RPS</p>
            </div>
            <div className="rounded-md border border-gray-200 p-2 text-xs dark:border-gray-700 dark:text-gray-200">
              <p className="mb-1 font-semibold text-gray-700 dark:text-gray-200">장애 중</p>
              {result.duringFailure ? (
                <>
                  <p>종단 지연: {formatLatency(result.duringFailure.endToEndLatencyMs)}</p>
                  <p>처리량: {result.duringFailure.throughputRps.toFixed(1)} RPS</p>
                </>
              ) : (
                <p className="text-gray-400 dark:text-gray-500">장애 시나리오를 선택하지 않았어요.</p>
              )}
            </div>
          </div>

          {!result.validation.passed && (
            <p className="text-xs text-red-600 dark:text-red-400">⚠️ 정적 검증에서 치명적인 문제가 발견됐어요 — 정적 검증 탭을 확인하세요.</p>
          )}

          {result.warnings.length > 0 && (
            <ul className="list-disc pl-4 text-[11px] text-gray-400 dark:text-gray-500">
              {[...new Set(result.warnings)].map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          )}

          <p className="text-xs text-gray-600 dark:text-gray-300">월 예상 비용: ${result.estimatedMonthlyCostUsd.toFixed(2)}</p>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">실행 이력 (최대 2개 선택해서 비교)</p>
        {runsQuery.data && runsQuery.data.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {runsQuery.data.map((run) => (
              <li key={run.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedRunIds.includes(run.id)}
                    onChange={() => toggleRunSelection(run.id)}
                    className="shrink-0"
                  />
                  <span className="w-24 shrink-0 text-gray-500 dark:text-gray-400">{formatRunTimestamp(run.createdAt)}</span>
                  <span className={run.validationPassed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {run.validationPassed ? "✓" : "⚠"}
                  </span>
                  <span className="text-gray-600 dark:text-gray-300">가용성 {run.estimatedAvailabilityPercent.toFixed(2)}%</span>
                  <span className="ml-auto font-medium text-gray-700 dark:text-gray-200">월 ${run.estimatedMonthlyCostUsd.toFixed(2)}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">아직 실행한 시뮬레이션이 없어요.</p>
        )}

        {selectedRuns.length === MAX_COMPARE_SELECTION && (
          <div className="overflow-x-auto rounded-md border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="p-2 text-left font-medium text-gray-500 dark:text-gray-400"> </th>
                  {selectedRuns.map((run) => (
                    <th key={run.id} className="p-2 text-left font-medium text-gray-700 dark:text-gray-200">
                      {formatRunTimestamp(run.createdAt)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 text-gray-500 dark:text-gray-400">목표 가용성</td>
                  {selectedRuns.map((run) => (
                    <td key={run.id} className="p-2 text-gray-700 dark:text-gray-200">
                      {run.targetAvailability}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 text-gray-500 dark:text-gray-400">추정 가용성</td>
                  {selectedRuns.map((run) => (
                    <td key={run.id} className="p-2 text-gray-700 dark:text-gray-200">
                      {run.estimatedAvailabilityPercent.toFixed(3)}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 text-gray-500 dark:text-gray-400">예상 RPS</td>
                  {selectedRuns.map((run) => (
                    <td key={run.id} className="p-2 text-gray-700 dark:text-gray-200">
                      {run.expectedRps}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="p-2 text-gray-500 dark:text-gray-400">정적 검증</td>
                  {selectedRuns.map((run) => (
                    <td
                      key={run.id}
                      className={run.validationPassed ? "p-2 text-emerald-600 dark:text-emerald-400" : "p-2 text-red-600 dark:text-red-400"}
                    >
                      {run.validationPassed ? "✓ 통과" : "⚠ 실패"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-2 font-medium text-gray-700 dark:text-gray-200">월 예상 비용</td>
                  {selectedRuns.map((run) => (
                    <td key={run.id} className="p-2 font-medium text-gray-700 dark:text-gray-200">
                      ${run.estimatedMonthlyCostUsd.toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="border-t border-gray-200 p-2 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
              비용 변화: {selectedRuns[1].estimatedMonthlyCostUsd - selectedRuns[0].estimatedMonthlyCostUsd >= 0 ? "+" : ""}
              ${(selectedRuns[1].estimatedMonthlyCostUsd - selectedRuns[0].estimatedMonthlyCostUsd).toFixed(2)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
