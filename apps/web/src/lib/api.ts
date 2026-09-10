import type {
  ApiResponse,
  ArchitectureDashboardSummary,
  ArchitectureDetail,
  ArchitectureValidationReport,
  ComponentPresetCatalogItem,
  CreateArchitectureRequest,
  CreateSimulationRunRequest,
  FailureScenarioCatalogItem,
  NodeCapacityPreviewRequest,
  NodeCapacityPreviewResult,
  ShareArchitectureResponse,
  SimulationRunResult,
  SimulationRunSummary,
  UpdateArchitectureRequest,
  ValidationRuleCatalogItem,
} from "@nangman/shared-types";

const BASE_PATH = "/api/backend";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_PATH}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = (await response.json()) as ApiResponse<T>;
  if (!body.success) {
    throw new Error(body.error.message);
  }
  return body.data;
}

export function listArchitectures(): Promise<ArchitectureDashboardSummary[]> {
  return request<ArchitectureDashboardSummary[]>("/architectures");
}

export function createArchitecture(input: CreateArchitectureRequest): Promise<ArchitectureDetail> {
  return request<ArchitectureDetail>("/architectures", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteArchitecture(id: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/architectures/${id}`, { method: "DELETE" });
}

export function getArchitecture(id: string): Promise<ArchitectureDetail> {
  return request<ArchitectureDetail>(`/architectures/${id}`);
}

export function updateArchitecture(id: string, input: UpdateArchitectureRequest): Promise<ArchitectureDetail> {
  return request<ArchitectureDetail>(`/architectures/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function validateArchitecture(id: string): Promise<ArchitectureValidationReport> {
  return request<ArchitectureValidationReport>(`/architectures/${id}/validate`, { method: "POST" });
}

export function getComponentPresets(): Promise<ComponentPresetCatalogItem[]> {
  return request<ComponentPresetCatalogItem[]>("/catalog/component-presets");
}

export function previewNodeCapacity(input: NodeCapacityPreviewRequest): Promise<NodeCapacityPreviewResult> {
  return request<NodeCapacityPreviewResult>("/simulate/node-capacity-preview", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getFailureScenarios(): Promise<FailureScenarioCatalogItem[]> {
  return request<FailureScenarioCatalogItem[]>("/catalog/failure-scenarios");
}

export function runSimulation(architectureId: string, input: CreateSimulationRunRequest): Promise<SimulationRunResult> {
  return request<SimulationRunResult>(`/architectures/${architectureId}/simulations`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function listSimulationRuns(architectureId: string): Promise<SimulationRunSummary[]> {
  return request<SimulationRunSummary[]>(`/architectures/${architectureId}/simulations`);
}

export function shareArchitecture(id: string): Promise<ShareArchitectureResponse> {
  return request<ShareArchitectureResponse>(`/architectures/${id}/share`, { method: "POST" });
}

export function unshareArchitecture(id: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/architectures/${id}/share`, { method: "DELETE" });
}

export function getSharedArchitecture(shareToken: string): Promise<ArchitectureDetail> {
  return request<ArchitectureDetail>(`/shared/${shareToken}`);
}

export function getValidationRuleCatalog(): Promise<ValidationRuleCatalogItem[]> {
  return request<ValidationRuleCatalogItem[]>("/catalog/validation-rules");
}
