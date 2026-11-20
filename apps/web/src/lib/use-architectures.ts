"use client";

import type { ArchitectureDashboardSummary, ArchitectureDetail, CreateArchitectureRequest } from "@nangman/shared-types";
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { createArchitecture, deleteArchitecture, duplicateArchitecture, listArchitectures, updateArchitecture } from "./api";

const ARCHITECTURES_QUERY_KEY = ["architectures"] as const;

export function useArchitectures(options?: { enabled?: boolean }): UseQueryResult<ArchitectureDashboardSummary[], Error> {
  return useQuery({ queryKey: ARCHITECTURES_QUERY_KEY, queryFn: listArchitectures, enabled: options?.enabled ?? true });
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

export function useDuplicateArchitecture(): UseMutationResult<ArchitectureDetail, Error, string> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => duplicateArchitecture(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ARCHITECTURES_QUERY_KEY });
    },
  });
}

export function useRenameArchitecture(): UseMutationResult<ArchitectureDetail, Error, { id: string; name: string }> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateArchitecture(id, { name }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ARCHITECTURES_QUERY_KEY });
    },
  });
}
