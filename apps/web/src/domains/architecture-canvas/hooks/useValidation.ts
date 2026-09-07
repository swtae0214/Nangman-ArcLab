"use client";

import type { ArchitectureValidationReport } from "@nangman/shared-types";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { validateArchitecture } from "@/lib/api";

export function useValidation(id: string): UseMutationResult<ArchitectureValidationReport, Error, void> {
  return useMutation({
    mutationFn: () => validateArchitecture(id),
  });
}
