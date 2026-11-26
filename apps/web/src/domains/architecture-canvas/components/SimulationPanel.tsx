"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { SimulationRunSummary } from "@nangman/shared-types";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useDeleteSimulationRun, useFailureScenarios, useRunSimulation, useSimulationRuns } from "../hooks/useSimulation";

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

/** 선택 바에서 삭제를 누르면 6초간 되돌릴 수 있게 미뤄둔 배치. */
type PendingDelete = { ids: string[]; batchId: number };

const UNDO_WINDOW_MS = 6_000;

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

function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="M3 6h18" strokeLinecap="round" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 11v6M14 11v6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 삭제 직후 6초 동안 보여주는 되돌리기 토스트. 호출부에서 `key={batchId}`로 매번 새로
 * 마운트해 진행 막대가 처음부터 다시 줄어들게 한다(그래서 이 안에서는 true로 바꾸기만 한다).
 */
function DeleteUndoToast({ count, onUndo }: { count: number; onUndo: () => void }) {
  const [shrink, setShrink] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShrink(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div role="status" className="flex shrink-0 flex-col gap-2 border-t border-gray-200 bg-gray-900 p-3 text-xs text-white dark:border-gray-700">
      <div className="flex items-center gap-3">
        <span>{count}개를 삭제했어요</span>
        <button type="button" onClick={onUndo} className="font-medium text-blue-300 underline hover:text-blue-200">
          되돌리기
        </button>
      </div>
      <div className="h-1 w-full overflow-hidden rounded bg-gray-700">
        <div
          className={`h-full bg-blue-400 transition-[width] ease-linear ${shrink ? "w-0" : "w-full"}`}
          style={{ transitionDuration: `${UNDO_WINDOW_MS}ms` }}
        />
      </div>
    </div>
  );
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
  const deleteRun = useDeleteSimulationRun(architectureId);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  // B9: 2개를 고른다고 표가 바로 뜨면 "왜 떴는지" 헷갈려서, 명시적으로 "비교" 버튼을 눌러야 뜨게 한다.
  const [isComparing, setIsComparing] = useState(false);
  // P3: 관찰 기간은 select 대신 세그먼트 버튼으로 고르지만, 저장되는 값은 그대로 초 단위다.
  const [observationPeriodSec, setObservationPeriodSec] = useState(30 * SECONDS_PER_DAY);
  // 비교는 2개까지지만, 삭제를 위해 선택 자체는 3개 이상도 허용한다 — 바의 보조문구로 이유를 알려준다.
  const toggleRunSelection = (runId: string) => {
    setIsComparing(false);
    setSelectedRunIds((prev) => (prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId]));
  };
  const clearSelection = () => {
    setSelectedRunIds([]);
    setIsComparing(false);
  };

  // 실행 이력이 테스트를 반복할수록 쌓이는 문제 — 선택한 걸 바로 지울 수 있게 한다(최근 20개가
  // 넘으면 서버가 가장 오래된 것부터 알아서 지우지만, 그 전에 치우고 싶을 때는 이걸로).
  // 확인창 대신 되돌리기 토스트를 쓴다 — 누르는 순간 목록에서만 숨기고, 6초 뒤에야 실제로 서버에서 지운다.
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);
  const pendingDeleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitPendingDelete = (batch: PendingDelete) => {
    batch.ids.forEach((id) => deleteRun.mutate(id));
  };

  const handleDeleteSelected = () => {
    if (pendingDeleteTimeoutRef.current) {
      clearTimeout(pendingDeleteTimeoutRef.current);
      pendingDeleteTimeoutRef.current = null;
    }
    // 토스트가 떠 있는 동안 또 삭제하면, 앞의 배치를 먼저 확정하고 새 토스트로 교체한다.
    setPendingDelete((previous) => {
      if (previous) commitPendingDelete(previous);
      return null;
    });

    const ids = selectedRunIds;
    const batch: PendingDelete = { ids, batchId: Date.now() };
    setSelectedRunIds([]);
    setIsComparing(false);
    setPendingDelete(batch);
    pendingDeleteTimeoutRef.current = setTimeout(() => {
      commitPendingDelete(batch);
      setPendingDelete(null);
      pendingDeleteTimeoutRef.current = null;
    }, UNDO_WINDOW_MS);
  };

  const handleUndoDelete = () => {
    if (pendingDeleteTimeoutRef.current) {
      clearTimeout(pendingDeleteTimeoutRef.current);
      pendingDeleteTimeoutRef.current = null;
    }
    setPendingDelete(null);
  };

  useEffect(() => {
    return () => {
      if (pendingDeleteTimeoutRef.current) clearTimeout(pendingDeleteTimeoutRef.current);
    };
  }, []);

  const visibleRuns = runsQuery.data?.filter((run) => !pendingDelete?.ids.includes(run.id));
  const selectedRuns = selectedRunIds
    .map((runId) => runsQuery.data?.find((run) => run.id === runId))
    .filter((run): run is SimulationRunSummary => run !== undefined);
  const selectionSubtitle =
    selectedRunIds.length === 1
      ? "비교하려면 하나 더 고르세요"
      : selectedRunIds.length === 2
        ? "비교하거나 삭제할 수 있어요"
        : selectedRunIds.length >= 3
          ? "비교는 2개까지만 할 수 있어요"
          : "";
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

  // 비교표가 이력 목록 맨 아래에 인라인으로 뜨면 스크롤해야 보였던 문제 — 패널 좌측에 뜨는
  // 팝업으로 바꾼다. 우측 패널이 "접힌 채 호버로만 미리보기"되는 모드에서는 그 미리보기 영역
  // 자체가 overflow-hidden이라 absolute로는 잘려서, document.body로 포털링해 피해간다.
  // (getBoundingClientRect는 overflow로 가려진 상태와 무관하게 실제 레이아웃 위치를 돌려준다.)
  const panelRootRef = useRef<HTMLDivElement>(null);
  const comparePopupRef = useRef<HTMLDivElement>(null);
  const [comparePopupPos, setComparePopupPos] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    // isComparing이 꺼지면 렌더 조건(`isComparing &&`)이 이미 팝업을 안 보여주므로, 남은
    // comparePopupPos 값은 다음에 다시 열릴 때 updatePosition()이 덮어쓸 때까지 그냥 둔다.
    if (!isComparing) return;
    const updatePosition = () => {
      const rect = panelRootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setComparePopupPos({ top: rect.top + 8, right: window.innerWidth - rect.left + 8 });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    const resizeObserver = new ResizeObserver(updatePosition);
    if (panelRootRef.current) resizeObserver.observe(panelRootRef.current);
    return () => {
      window.removeEventListener("resize", updatePosition);
      resizeObserver.disconnect();
    };
  }, [isComparing]);

  useEffect(() => {
    if (!isComparing) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (comparePopupRef.current && !comparePopupRef.current.contains(event.target as Node)) {
        setIsComparing(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsComparing(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isComparing]);

  return (
    <div ref={panelRootRef} className="relative flex h-full flex-col dark:bg-gray-900">
    {selectedRuns.length === MAX_COMPARE_SELECTION &&
      isComparing &&
      comparePopupPos &&
      createPortal(
        <div
          ref={comparePopupRef}
          role="dialog"
          aria-modal="true"
          aria-label="실행 기록 비교"
          style={{ position: "fixed", top: comparePopupPos.top, right: comparePopupPos.right }}
          className="z-50 max-h-[75vh] w-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
        >
        <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">실행 기록 비교</p>
          <button
            type="button"
            onClick={() => setIsComparing(false)}
            aria-label="비교 닫기"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <div className="overflow-x-auto">
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
        </div>,
        document.body,
      )}
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
            실행 이력 <span className="font-normal text-gray-400 dark:text-gray-500">비교하거나 삭제할 기록을 고르세요</span>
          </p>
          <p className="shrink-0 text-[11px] text-gray-400 dark:text-gray-500">목표 {targetAvailability}%</p>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">최근 20개까지만 보관되고, 오래된 순으로 자동으로 지워져요.</p>
        {visibleRuns && visibleRuns.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {visibleRuns.map((run) => {
              const meetsTarget = run.estimatedAvailabilityPercent >= run.targetAvailability;
              const isSelected = selectedRunIds.includes(run.id);
              return (
                <li key={run.id}>
                  <label
                    className={`flex min-w-0 cursor-pointer items-start gap-2 rounded border px-2 py-1.5 text-xs ${
                      isSelected
                        ? "border-blue-400 bg-[#F5F7FF] dark:border-blue-500 dark:bg-blue-950/40"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
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
      </div>
    </div>

    {/* 선택/삭제 바 — 스크롤과 무관하게 패널 하단에 고정. 삭제 직후엔 되돌리기 토스트로 바뀐다. */}
    {pendingDelete ? (
      <DeleteUndoToast key={pendingDelete.batchId} count={pendingDelete.ids.length} onUndo={handleUndoDelete} />
    ) : (
      selectedRunIds.length > 0 && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200 p-3 text-xs dark:border-gray-700">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-700 dark:text-gray-200">{selectedRunIds.length}개 선택됨</span>
            <span className="text-gray-400 dark:text-gray-500">{selectionSubtitle}</span>
            <button type="button" onClick={clearSelection} className="ml-1 text-gray-500 hover:underline dark:text-gray-400">
              선택 해제
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDeleteSelected}
              aria-label={`선택한 실행 기록 ${selectedRunIds.length}개 삭제`}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-[#D92D20] px-3 font-medium text-[#B42318] hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <TrashIcon />
              삭제 ({selectedRunIds.length})
            </button>
            <button
              type="button"
              disabled={selectedRunIds.length !== MAX_COMPARE_SELECTION}
              aria-disabled={selectedRunIds.length !== MAX_COMPARE_SELECTION}
              onClick={() => setIsComparing(true)}
              className={`ml-auto flex h-9 items-center rounded-lg px-3 font-medium ${
                selectedRunIds.length === MAX_COMPARE_SELECTION
                  ? "bg-[#364FC7] text-white hover:brightness-110"
                  : "cursor-not-allowed bg-[#E5E7EB] text-[#8A93A3] dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              비교하기
            </button>
          </div>
        </div>
      )
    )}
    </div>
  );
}
