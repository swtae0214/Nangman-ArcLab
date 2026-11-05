import type {
  ApiResponse,
  ArchitectureDashboardSummary,
  ArchitectureDetail,
  ArchitectureValidationReport,
  ComponentPresetCatalogItem,
  CreateArchitectureRequest,
  CreateSimulationRunRequest,
  CurrentUser,
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

/** 브라우저를 그대로 GitHub 로그인 화면으로 보내는 전체 페이지 이동용 주소 (fetch가 아니라 location 이동으로 써야 한다). */
export const GITHUB_LOGIN_URL = `${BASE_PATH}/auth/github/login`;

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

/**
 * "지금 로그인한 사람이 있나?"를 물어보는 용도라, 일반 request()와 달리 실패해도 에러를 던지지
 * 않고 null을 돌려준다 — 로그아웃 상태가 "에러"는 아니기 때문이다.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const response = await fetch(`${BASE_PATH}/auth/me`);
  if (response.status === 401) return null;
  const body = (await response.json()) as ApiResponse<CurrentUser>;
  return body.success ? body.data : null;
}

export async function logout(): Promise<void> {
  await fetch(`${BASE_PATH}/auth/logout`, { method: "POST" });
}
