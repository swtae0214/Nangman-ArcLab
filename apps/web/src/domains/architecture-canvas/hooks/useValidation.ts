"use client";

import type { ArchitectureGraph, ArchitectureValidationReport, ValidationPreviewResult } from "@nangman/shared-types";
import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { validateArchitecture, validateArchitecturePreview } from "@/lib/api";

export function useValidation(id: string): UseMutationResult<ArchitectureValidationReport, Error, void> {
  return useMutation({
    mutationFn: () => validateArchitecture(id),
  });
}

/** F3: "빼고 시험해 보기" — 전달한 가상 그래프를 저장 없이 검증·비용만 미리 계산한다. */
export function useValidationPreview(id: string): UseMutationResult<ValidationPreviewResult, Error, ArchitectureGraph> {
  return useMutation({
    mutationFn: (graph: ArchitectureGraph) => validateArchitecturePreview(id, graph),
  });
}
