"use client";

import type { ArchitectureDashboardSummary, ArchitectureDetail, CreateArchitectureRequest } from "@nangman/shared-types";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { createArchitecture, deleteArchitecture, listArchitectures } from "./api";

const ARCHITECTURES_QUERY_KEY = ["architectures"] as const;

export function useArchitectures(): UseQueryResult<ArchitectureDashboardSummary[], Error> {
  return useQuery({ queryKey: ARCHITECTURES_QUERY_KEY, queryFn: listArchitectures });
}

export function useCreateArchitecture(): UseMutationResult<ArchitectureDetail, Error, CreateArchitectureRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateArchitectureRequest) => createArchitecture(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ARCHITECTURES_QUERY_KEY });
    },
  });
}

export function useDeleteArchitecture(): UseMutationResult<unknown, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArchitecture(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ARCHITECTURES_QUERY_KEY });
    },
  });
}
