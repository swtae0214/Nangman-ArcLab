"use client";

import type { ComponentPresetCatalogItem, NodeCapacityPreviewRequest, NodeCapacityPreviewResult } from "@nangman/shared-types";
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { getComponentPresets, previewNodeCapacity } from "@/lib/api";

export function useComponentPresets(): UseQueryResult<ComponentPresetCatalogItem[], Error> {
  return useQuery({ queryKey: ["component-presets"], queryFn: getComponentPresets });
}

export function useNodeCapacityPreview(): UseMutationResult<NodeCapacityPreviewResult, Error, NodeCapacityPreviewRequest> {
  return useMutation({ mutationFn: previewNodeCapacity });
}
