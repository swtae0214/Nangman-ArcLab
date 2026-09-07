"use client";

import type { CreateSimulationRunRequest, FailureScenarioCatalogItem, SimulationRunResult } from "@nangman/shared-types";
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { getFailureScenarios, runSimulation } from "@/lib/api";

export function useFailureScenarios(): UseQueryResult<FailureScenarioCatalogItem[], Error> {
  return useQuery({ queryKey: ["failure-scenarios"], queryFn: getFailureScenarios });
}

export function useRunSimulation(architectureId: string): UseMutationResult<SimulationRunResult, Error, CreateSimulationRunRequest> {
  return useMutation({
    mutationFn: (input: CreateSimulationRunRequest) => runSimulation(architectureId, input),
  });
}
