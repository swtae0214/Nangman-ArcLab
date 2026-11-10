"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useFailureScenarios, useRunSimulation } from "../hooks/useSimulation";

const SECONDS_PER_DAY = 86_400;

const formSchema = z.object({
  targetAvailability: z.number().min(0).max(100),
  expectedRps: z.number().min(0),
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
export function SimulationPanel({ architectureId }: { architectureId: string }) {
  const failureScenariosQuery = useFailureScenarios();
  const runSimulation = useRunSimulation(architectureId);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetAvailability: 99.9,
      expectedRps: 100,
      failureScenarioCode: "",
      observationPeriodSec: 30 * SECONDS_PER_DAY,
    },
  });

  const onSubmit = handleSubmit((values) => {
    runSimulation.mutate({
      targetAvailability: values.targetAvailability,
      expectedRps: values.expectedRps,
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

        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          예상 RPS
          <input
            type="number"
            min={0}
            step="any"
            {...register("expectedRps", { valueAsNumber: true })}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          />
          {errors.expectedRps && (
            <span className="mt-0.5 block text-[11px] text-red-500 dark:text-red-400">{errors.expectedRps.message}</span>
          )}
        </label>

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
          disabled={runSimulation.isPending}
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
        </div>
      )}
    </div>
  );
}
