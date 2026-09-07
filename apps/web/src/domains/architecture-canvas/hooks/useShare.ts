"use client";

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";
import type { ShareArchitectureResponse } from "@nangman/shared-types";
import { shareArchitecture, unshareArchitecture } from "@/lib/api";

export function useShareArchitecture(id: string): UseMutationResult<ShareArchitectureResponse, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => shareArchitecture(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["architectures", id] }),
  });
}

export function useUnshareArchitecture(id: string): UseMutationResult<{ id: string }, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => unshareArchitecture(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["architectures", id] }),
  });
}
