"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SimulationRunSummary } from "@nangman/shared-types";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useFailureScenarios, useRunSimulation, useSimulationRuns } from "../hooks/useSimulation";

const SECONDS_PER_DAY = 86_400;
const MAX_COMPARE_SELECTION = 2;

/** B9: 초 단위 raw 입력("2592000") 대신 의미가 바로 와닿는 기간 단위로 고르게 한다. */
const OBSERVATION_PERIOD_OPTIONS = [
  { label: "1일", seconds: SECONDS_PER_DAY },
  { label: "7일", seconds: 7 * SECONDS_PER_DAY },
  { label: "30일", seconds: 30 * SECONDS_PER_DAY },
];

function formatRunTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const formSchema = z.object({
  targetAvailability: z.number().min(0).max(100),
  failureScenarioCode: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

function formatLatency(ms: number | null): string {
  return ms === null ? "계산 불가(포화)" : `${ms.toFixed(1)}ms`;
}

/** P3: 실행 이력·비교표의 비용 — 천 단위 쉼표, 소수점은 안 보여준다(원래도 추정치라 센트 단위가 의미 없다). */
function formatMonthlyCost(usd: number): string {
  return `$${Math.round(usd).toLocaleString("en-US")}`;
}

/** P3: 장애 시나리오 코드 → 실행 이력 행의 제목으로 쓸 이름. 평상시 실행은 "장애 없음"으로 보여준다
 *  (입력 폼 select의 "없음 (평상시만 계산)"과는 다른, 이력 목록 전용 문구). */
function scenarioTitle(code: string | undefined, scenarios: { code: string; displayName: string }[] | undefined): string {
  if (!code) return "장애 없음";
  return scenarios?.find((scenario) => scenario.code === code)?.displayName ?? code;
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
  // B9: 2개를 고른다고 표가 바로 뜨면 "왜 떴는지" 헷갈려서, 명시적으로 "비교" 버튼을 눌러야 뜨게 한다.
  const [isComparing, setIsComparing] = useState(false);
  // P3: 관찰 기간은 select 대신 세그먼트 버튼으로 고르지만, 저장되는 값은 그대로 초 단위다.
  const [observationPeriodSec, setObservationPeriodSec] = useState(30 * SECONDS_PER_DAY);
  // P3: 3개째를 고르면 가장 먼저 고른 걸 조용히 밀어내는 대신, 막고 이유를 보여준다.
  const [selectionLimitMessage, setSelectionLimitMessage] = useState<string | null>(null);
  const toggleRunSelection = (runId: string) => {
    setIsComparing(false);
    setSelectedRunIds((prev) => {
      if (prev.includes(runId)) {
        setSelectionLimitMessage(null);
        return prev.filter((id) => id !== runId);
      }
      if (prev.length >= MAX_COMPARE_SELECTION) {
        setSelectionLimitMessage("최대 2개까지 비교할 수 있어요 — 하나를 선택 해제하고 다시 골라 보세요.");
        return prev;
      }
      setSelectionLimitMessage(null);
      return [...prev, runId];
    });
  };
  const clearSelection = () => {
    setSelectedRunIds([]);
    setIsComparing(false);
    setSelectionLimitMessage(null);
  };
  const selectedRuns = selectedRunIds
    .map((runId) => runsQuery.data?.find((run) => run.id === runId))
    .filter((run): run is SimulationRunSummary => run !== undefined);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetAvailability: 99.9,
      failureScenarioCode: "",
    },
  });
  const targetAvailability = useWatch({ control, name: "targetAvailability" });

  const onSubmit = handleSubmit((values) => {
    if (entryAvgRps === undefined) return;
    runSimulation.mutate({
      targetAvailability: values.targetAvailability,
      expectedRps: entryAvgRps,
      observationPeriodSec,
      ...(values.failureScenarioCode ? { failureScenarioCode: values.failureScenarioCode } : {}),
    });
  });

  const result = runSimulation.data;

  return (
    <div className="flex h-full flex-col dark:bg-gray-900">
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        서버 대수와 요청량으로 대기 시간과 가용성을 계산해요. 장애를 가정해 볼 수도 있어요.
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

        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
          관찰 기간
          <div className="mt-1 grid grid-cols-3 gap-1.5">
            {OBSERVATION_PERIOD_OPTIONS.map((option) => (
              <button
                key={option.seconds}
                type="button"
                onClick={() => setObservationPeriodSec(option.seconds)}
                className={`rounded border px-2 py-1.5 text-sm font-medium ${
                  observationPeriodSec === option.seconds
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* 규칙 5: 주 버튼은 파랑 하나로 통일 — 검정 주 버튼 금지. */}
        <button
          type="submit"
          disabled={runSimulation.isPending || entryAvgRps === undefined}
          title={entryAvgRps === undefined ? "사용자 노드에 평균 요청 수를 먼저 입력하세요" : undefined}
          className="mt-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
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

          <p className="text-xs text-gray-600 dark:text-gray-300">월 예상 비용: {formatMonthlyCost(result.estimatedMonthlyCostUsd)}</p>
        </div>
      )}

      <div className="mt-2 flex flex-col gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
            실행 이력 <span className="font-normal text-gray-400 dark:text-gray-500">2개를 골라 비교해 보세요</span>
          </p>
          <p className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">목표 {targetAvailability}%</p>
        </div>
        {runsQuery.data && runsQuery.data.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {runsQuery.data.map((run) => {
              const meetsTarget = run.estimatedAvailabilityPercent >= run.targetAvailability;
              return (
                <li key={run.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 px-2 py-1.5 text-xs dark:border-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedRunIds.includes(run.id)}
                      onChange={() => toggleRunSelection(run.id)}
                      className="mt-0.5 shrink-0"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-700 dark:text-gray-200">
                        {scenarioTitle(run.failureScenarioCode, failureScenariosQuery.data)}
                      </span>
                      <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                        {run.expectedRps} RPS · {formatRunTimestamp(run.createdAt)}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="flex items-center gap-1 text-gray-700 dark:text-gray-200">
                        {run.estimatedAvailabilityPercent.toFixed(2)}%
                        <span className={meetsTarget ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                          {meetsTarget ? "✓ 충족" : "▲ 미달"}
                        </span>
                      </span>
                      <span className="font-medium text-gray-700 dark:text-gray-200">월 {formatMonthlyCost(run.estimatedMonthlyCostUsd)}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">아직 실행한 시뮬레이션이 없어요.</p>
        )}

        {selectionLimitMessage && <p className="text-[11px] text-red-500 dark:text-red-400">{selectionLimitMessage}</p>}

        {selectedRuns.length === MAX_COMPARE_SELECTION && isComparing && (
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
                  <td className="p-2 text-gray-500 dark:text-gray-400">장애 시나리오</td>
                  {selectedRuns.map((run) => (
                    <td key={run.id} className="p-2 text-gray-700 dark:text-gray-200">
                      {scenarioTitle(run.failureScenarioCode, failureScenariosQuery.data)}
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
                      {formatMonthlyCost(run.estimatedMonthlyCostUsd)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="border-t border-gray-200 p-2 text-[11px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
              비용 변화: {selectedRuns[1].estimatedMonthlyCostUsd - selectedRuns[0].estimatedMonthlyCostUsd >= 0 ? "+" : ""}
              {formatMonthlyCost(selectedRuns[1].estimatedMonthlyCostUsd - selectedRuns[0].estimatedMonthlyCostUsd)}
            </p>
          </div>
        )}
      </div>
    </div>

    {/* P3: 2개를 고르면 패널 하단에 고정되는 비교 바 — 스크롤과 무관하게 항상 보인다. */}
    {selectedRuns.length > 0 && (
      <div className="flex shrink-0 items-center gap-2 border-t border-gray-200 p-3 text-xs dark:border-gray-700">
        <span className="font-medium text-gray-700 dark:text-gray-200">{selectedRuns.length}개 선택됨</span>
        <button type="button" onClick={clearSelection} className="text-gray-500 hover:underline dark:text-gray-400">
          선택 해제
        </button>
        <button
          type="button"
          disabled={selectedRuns.length !== MAX_COMPARE_SELECTION}
          onClick={() => setIsComparing(true)}
          className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          비교하기
        </button>
      </div>
    )}
    </div>
  );
}
