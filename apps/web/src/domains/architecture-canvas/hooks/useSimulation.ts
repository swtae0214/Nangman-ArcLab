"use client";

import type {
  CreateSimulationRunRequest,
  FailureScenarioCatalogItem,
  SimulationRunResult,
  SimulationRunSummary,
} from "@nangman/shared-types";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { getFailureScenarios, listSimulationRuns, runSimulation } from "@/lib/api";

export function useFailureScenarios(): UseQueryResult<FailureScenarioCatalogItem[], Error> {
  return useQuery({ queryKey: ["failure-scenarios"], queryFn: getFailureScenarios });
}

export function useRunSimulation(architectureId: string): UseMutationResult<SimulationRunResult, Error, CreateSimulationRunRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSimulationRunRequest) => runSimulation(architectureId, input),
    // F2: 새로 실행한 결과가 "실행 이력" 목록에도 바로 보이도록, 성공하면 그 목록 쿼리를 다시 받아온다.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["simulation-runs", architectureId] });
    },
  });
}

/** F2: "실험 비용 비교"가 쓰는 과거 실행 이력 목록 — 서버에 이미 있던 엔드포인트를 처음으로 연결한다. */
export function useSimulationRuns(architectureId: string): UseQueryResult<SimulationRunSummary[], Error> {
  return useQuery({ queryKey: ["simulation-runs", architectureId], queryFn: () => listSimulationRuns(architectureId) });
}
