"use client";

import type { ArchitectureGraph, ArchitectureValidationReport } from "@nangman/shared-types";
import { useMemo } from "react";
import { COMPONENT_META } from "../component-meta";
import { COST_RELEVANT_TYPES, PRESET_SELECTABLE_TYPES } from "../node-cost";
import type { SelectedElementConnection, SelectedElementInfo } from "../types";
import { DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB } from "../usage-based-cost";
import { RULE_RELATED_COMPONENT_TYPES, SEVERITY_ICON, SEVERITY_LABEL, SEVERITY_PILL_STYLE } from "../validation-style";
import { AppRunnerInspectorSection } from "./AppRunnerInspectorSection";
import { CapacityInspectorSection } from "./CapacityInspectorSection";
import { CdnInspectorSection } from "./CdnInspectorSection";
import { IamInspectorSection } from "./IamInspectorSection";
import { computeGlobalMonthlyFigures, GlobalTrafficSummarySection } from "./GlobalTrafficSummarySection";
import { LoadBalancerInspectorSection } from "./LoadBalancerInspectorSection";
import { QueueInspectorSection } from "./QueueInspectorSection";
import { WhatIfRemovePanel } from "./WhatIfRemovePanel";

interface SelectionDetailPanelProps {
  architectureId: string;
  /** F3: "빼고 시험해 보기"가 노드를 뺀 가상 그래프를 만들 때 쓰는, 지금 캔버스의 실제(저장 전 포함) 그래프. */
  graph: ArchitectureGraph;
  elementInfo: SelectedElementInfo;
  report?: ArchitectureValidationReport;
  onFocusNodes: (nodeIds: string[]) => void;
  onClose: () => void;
  onGoToExperiment: () => void;
  onUpdateEntryTraffic: (nodeId: string, patch: { entryAvgRps?: number; entryPeakMultiplier?: number; entryAvgResponseSizeKb?: number }) => void;
  onUpdateEdgeTraffic: (
    edgeIds: string[],
    patch: { distributionWeight?: number; callsPerRequest?: number; iamPermissionGranted?: boolean },
  ) => void;
  onUpdateUsageBasedCostSettings: (
    nodeId: string,
    patch: {
      cdnCacheHitRatioPercent?: number;
      albConnectionReuse?: boolean;
      albRequestsPerConnection?: number;
      albAcceptPartialCost?: boolean;
    },
  ) => void;
  onUpdateCapacitySettings: (nodeId: string, patch: { instanceCount?: number }) => void;
  onUpdateRedundancySettings: (nodeId: string, patch: { appRunnerMinInstanceCount?: number }) => void;
  onUpdateQueueSettings: (nodeId: string, patch: { queueConsumerThroughputRps?: number }) => void;
}

interface ConnectionGroup {
  edgeIds: string[];
  label: string;
  edgeLabel?: string;
  kind: SelectedElementConnection["kind"];
  value?: number;
  /** F6(A2): true면 value가 사용자가 직접 정한 게 아니라 타입 쌍 기본값이다. */
  isDefaultValue?: boolean;
  /** F9(B7): 이 선(들)이 실제로 나르는 RPS. */
  resultRps?: number;
  /** F9(B7): kind가 "distribution"일 때만 — 형제 가중치 합 대비 비율(%). */
  distributionPercent?: number;
  /**
   * F4: "값이 달라서 따로 보여주는" 호출(call) 연결이 정확히 2개일 때만 채워진다 — 다른 쪽 값을
   * 이 그룹에도 그대로 적용할 수 있게 해주는 지름길. 3개 이상으로 값이 갈리면(어느 쪽을 기준으로
   * 맞출지 애매해서) 안 보여준다.
   */
  siblingApply?: { label: string; targetEdgeIds: string[]; value: number };
}

/**
 * 이름이 같고, 엣지 종류·값까지 전부 같을 때만 "웹 서버 ×2"처럼 묶는다 — 하나라도 다르면
 * (예: 분배 비율이 70/30으로 다르면) 묶음을 풀어서 각자 따로 보여준다.
 */
function groupConnections(connections: SelectedElementConnection[]): ConnectionGroup[] {
  const groups = new Map<string, ConnectionGroup>();
  for (const connection of connections) {
    const key = `${connection.label}__${connection.edgeLabel ?? ""}__${connection.kind}__${connection.value ?? ""}`;
    const existing = groups.get(key);
    if (existing) existing.edgeIds.push(connection.edgeId);
    else
      groups.set(key, {
        edgeIds: [connection.edgeId],
        label: connection.label,
        edgeLabel: connection.edgeLabel,
        kind: connection.kind,
        value: connection.value,
        isDefaultValue: connection.isDefaultValue,
        resultRps: connection.resultRps,
        distributionPercent: connection.distributionPercent,
      });
  }
  return Array.from(groups.values());
}

/** groupConnections가 쪼개놓은 그룹들 중, 값만 다른 호출(call) 연결 쌍에 siblingApply를 채워 넣는다. */
function withCallSiblingApply(groups: ConnectionGroup[]): ConnectionGroup[] {
  const callGroups = groups.filter((group) => group.kind === "call" && group.value !== undefined);
  return groups.map((group) => {
    if (group.kind !== "call" || group.value === undefined) return group;
    const others = callGroups.filter((candidate) => candidate !== group && candidate.value !== group.value);
    if (others.length !== 1) return group;
    const [other] = others;
    return { ...group, siblingApply: { label: other.label, targetEdgeIds: [...group.edgeIds, ...other.edgeIds], value: group.value } };
  });
}

const TRAFFIC_KIND_LABEL: Record<SelectedElementConnection["kind"], string> = {
  distribution: "분배",
  call: "호출",
  replication: "복제",
};

/** B7: 종류 칩에 색 구분 말고도 모양(아이콘)으로 구분이 되게 — 작아서 잘 안 보인다는 피드백으로 키움. */
const TRAFFIC_KIND_ICON: Record<SelectedElementConnection["kind"], string> = {
  distribution: "⑂",
  call: "↻",
  replication: "⧉",
};

function formatRps(rps: number): string {
  return `${rps < 10 ? rps.toFixed(1) : Math.round(rps)}/s`;
}

function ConnectionRow({
  arrow,
  group,
  onUpdateEdgeTraffic,
}: {
  arrow: "←" | "→";
  group: ConnectionGroup;
  onUpdateEdgeTraffic: (edgeIds: string[], patch: { distributionWeight?: number; callsPerRequest?: number }) => void;
}) {
  // B7: 분배(distribution)는 형제 목록을 쥐고 있는 "부모"(이 노드가 source인 → 쪽)에서만 가중치를
  // 바꿀 수 있다 — 자식(← 쪽)에서 편집하면 형제가 안 보이는 채로 비율을 바꾸는 꼴이라 혼란을 줬다.
  const isEditable = group.kind === "call" || (group.kind === "distribution" && arrow === "→");

  const handleValueChange = (raw: string) => {
    const nextValue = raw === "" ? undefined : Number(raw);
    if (group.kind === "distribution") onUpdateEdgeTraffic(group.edgeIds, { distributionWeight: nextValue });
    else if (group.kind === "call") onUpdateEdgeTraffic(group.edgeIds, { callsPerRequest: nextValue });
  };

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-3 py-2.5 ${
        group.kind === "replication" ? "border-dashed border-gray-300 dark:border-gray-600" : "border-gray-200 dark:border-gray-700"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
            {arrow}
          </span>
          <span className="truncate">{group.label}</span>
          {group.edgeIds.length > 1 && <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">×{group.edgeIds.length}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* edgeLabel(장식용 텍스트)이 바로 옆 종류 배지랑 같은 문구면("복제" 등) 중복으로 두 번 안 보이게 한다. */}
          {group.edgeLabel && group.edgeLabel !== TRAFFIC_KIND_LABEL[group.kind] && (
            <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">{group.edgeLabel}</span>
          )}
          <span className="flex h-5 items-center gap-1 whitespace-nowrap rounded bg-gray-100 px-2 text-[11px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
            <span aria-hidden>{TRAFFIC_KIND_ICON[group.kind]}</span>
            {TRAFFIC_KIND_LABEL[group.kind]}
          </span>
          {group.isDefaultValue && (
            <span className="whitespace-nowrap rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              기본값
            </span>
          )}
          {group.siblingApply && (
            <span className="whitespace-nowrap rounded bg-amber-50 px-1 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              다름
            </span>
          )}
        </span>
      </div>

      {group.kind === "call" && (
        <div className="flex items-center justify-between gap-2 pl-9 text-xs text-gray-600 dark:text-gray-300">
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            요청 1건당
            <input
              type="number"
              min={0}
              step="any"
              value={group.value ?? ""}
              onChange={(event) => handleValueChange(event.target.value)}
              className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-right text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            />
            회
          </span>
          {group.resultRps !== undefined && (
            <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">→ {formatRps(group.resultRps)}</span>
          )}
        </div>
      )}

      {group.kind === "distribution" &&
        (isEditable ? (
          <div className="flex items-center justify-between gap-2 pl-9 text-xs text-gray-600 dark:text-gray-300">
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              가중치
              <input
                type="number"
                min={0}
                step="any"
                value={group.value ?? ""}
                onChange={(event) => handleValueChange(event.target.value)}
                className="w-14 rounded border border-gray-300 px-1.5 py-0.5 text-right text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </span>
            <span className="whitespace-nowrap font-medium text-gray-700 dark:text-gray-200">
              {group.distributionPercent !== undefined && `${group.distributionPercent.toFixed(0)}%`}
              {group.resultRps !== undefined && ` · ${formatRps(group.resultRps)}`}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 pl-9 text-xs text-gray-500 dark:text-gray-400">
            <span>받는 비율</span>
            <span className="font-medium text-gray-700 dark:text-gray-200">
              가중치 {group.value} · {group.distributionPercent?.toFixed(0)}%
              {group.resultRps !== undefined && ` · ${formatRps(group.resultRps)}`}
            </span>
          </div>
        ))}

      {group.siblingApply && (
        <button
          type="button"
          onClick={() => onUpdateEdgeTraffic(group.siblingApply!.targetEdgeIds, { callsPerRequest: group.siblingApply!.value })}
          className="self-start pl-9 text-[11px] text-blue-600 hover:underline dark:text-blue-400"
        >
          {group.siblingApply.label}에도 {group.siblingApply.value} 적용
        </button>
      )}
    </div>
  );
}

function CheckCircleIcon({ ok }: { ok: boolean }) {
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white ${ok ? "bg-emerald-500" : "bg-red-500"}`}
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

export function SelectionDetailPanel({
  architectureId,
  graph,
  elementInfo,
  report,
  onFocusNodes,
  onClose,
  onGoToExperiment,
  onUpdateEntryTraffic,
  onUpdateEdgeTraffic,
  onUpdateUsageBasedCostSettings,
  onUpdateCapacitySettings,
  onUpdateRedundancySettings,
  onUpdateQueueSettings,
}: SelectionDetailPanelProps) {
  const meta = COMPONENT_META[elementInfo.type];
  const Icon = meta.Icon;
  const inputGroups = useMemo(() => withCallSiblingApply(groupConnections(elementInfo.inputs)), [elementInfo.inputs]);
  const outputGroups = useMemo(() => withCallSiblingApply(groupConnections(elementInfo.outputs)), [elementInfo.outputs]);

  const relatedResults = useMemo(() => {
    if (!report) return [];
    return report.results.filter((result) => {
      if (!result.applicable) return false;
      const relatedTypes = RULE_RELATED_COMPONENT_TYPES[result.ruleCode];
      if (relatedTypes?.includes(elementInfo.type)) return true;
      // SPOF-001처럼 규칙이 다루는 "대상 타입"과 실제로 지목하는 노드(절단점)가 다를 수 있어서,
      // 타입 매칭에 안 걸려도 이 요소가 그 규칙의 실패 목록에 직접 들어있으면 관련된 것으로 본다.
      return (result.detail.nodeIds ?? []).includes(elementInfo.id);
    });
  }, [report, elementInfo.id, elementInfo.type]);
  const allRelatedPassed = relatedResults.every((result) => result.passed);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon size={40} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{elementInfo.label}</p>
            <p className="truncate text-xs text-gray-400 dark:text-gray-500">{meta.label} · 선택한 요소</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {relatedResults.length > 0 && (
            <span
              className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                allRelatedPassed
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {allRelatedPassed ? "✓ 통과" : "⚠ 실패"}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="선택 해제"
            title="선택 해제"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>
      </div>

      {elementInfo.breadcrumb.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">{elementInfo.breadcrumb.join(" › ")}</p>
      )}

      {elementInfo.type === "USER" && (
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">전체 트래픽</p>
          <p className="-mt-1 mb-2 text-[11px] text-gray-400 dark:text-gray-500">
            한 번만 정하면 돼요 — 아래 모든 요소가 이 값을 이어받아요.
          </p>
          <div className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
              평균 요청 수
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={elementInfo.entryAvgRps ?? ""}
                  onChange={(event) =>
                    onUpdateEntryTraffic(elementInfo.id, {
                      entryAvgRps: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                RPS
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
              피크 때는 평균의 몇 배인가요?
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  step="any"
                  value={elementInfo.entryPeakMultiplier ?? ""}
                  onChange={(event) =>
                    onUpdateEntryTraffic(elementInfo.id, {
                      entryPeakMultiplier: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                배
              </span>
            </label>
            <label className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300">
              <span className="flex items-center gap-1.5">
                평균 응답 크기
                {elementInfo.entryAvgResponseSizeKb === undefined && (
                  <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    기본값
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1" title="CDN·로드밸런서의 비용 계산이 공통으로 쓰는 가정이에요">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={elementInfo.entryAvgResponseSizeKb ?? DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB}
                  onChange={(event) =>
                    onUpdateEntryTraffic(elementInfo.id, {
                      entryAvgResponseSizeKb: event.target.value === "" ? undefined : Number(event.target.value),
                    })
                  }
                  className="w-20 rounded border border-gray-300 px-2 py-1 text-right text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                />
                KB
              </span>
            </label>
            {elementInfo.entryAvgRps !== undefined && (
              <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                {(() => {
                  const { monthlyRequests, monthlyTransferGb } = computeGlobalMonthlyFigures(
                    elementInfo.entryAvgRps!,
                    elementInfo.entryAvgResponseSizeKb ?? DEFAULT_ENTRY_AVG_RESPONSE_SIZE_KB,
                  );
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <span>월 요청 수</span>
                        <span>{Math.round(monthlyRequests).toLocaleString()}건</span>
                      </div>
                      {monthlyTransferGb !== undefined && (
                        <div className="flex items-center justify-between">
                          <span>월 전송량</span>
                          <span>{monthlyTransferGb.toFixed(1)}GB</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <div className="mt-2">
            <GlobalTrafficSummarySection graph={graph} />
          </div>
        </div>
      )}

      {elementInfo.type === "CDN" && (
        <CdnInspectorSection elementInfo={elementInfo} onUpdateUsageBasedCostSettings={onUpdateUsageBasedCostSettings} />
      )}

      {elementInfo.type === "LOAD_BALANCER" && (
        <LoadBalancerInspectorSection elementInfo={elementInfo} onUpdateUsageBasedCostSettings={onUpdateUsageBasedCostSettings} />
      )}

      {PRESET_SELECTABLE_TYPES.includes(elementInfo.type) && (
        <CapacityInspectorSection elementInfo={elementInfo} onUpdateCapacitySettings={onUpdateCapacitySettings} />
      )}

      {elementInfo.type === "APP_RUNNER" && (
        <AppRunnerInspectorSection elementInfo={elementInfo} onUpdateRedundancySettings={onUpdateRedundancySettings} />
      )}

      {(elementInfo.type === "SQS" || elementInfo.type === "KINESIS_DATA_STREAMS") && (
        <QueueInspectorSection elementInfo={elementInfo} onUpdateQueueSettings={onUpdateQueueSettings} />
      )}

      <IamInspectorSection elementInfo={elementInfo} onUpdateEdgeTraffic={onUpdateEdgeTraffic} onFocusNodes={onFocusNodes} />

      {(inputGroups.length > 0 || outputGroups.length > 0) && (
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">연결</p>
          <div className="flex flex-col gap-2">
            {inputGroups.map((group, index) => (
              <ConnectionRow key={`in-${index}`} arrow="←" group={group} onUpdateEdgeTraffic={onUpdateEdgeTraffic} />
            ))}
            {outputGroups.map((group, index) => (
              <ConnectionRow key={`out-${index}`} arrow="→" group={group} onUpdateEdgeTraffic={onUpdateEdgeTraffic} />
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          이 요소와 관련된 검증 · {relatedResults.length}
        </p>
        {relatedResults.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {report ? "관련된 검증 규칙이 없어요." : '아직 검증을 실행하지 않았어요 — 상단의 "검증 실행"을 눌러보세요.'}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {relatedResults.map((result) => (
              <div key={result.ruleCode} className="flex flex-col gap-2 rounded-xl border border-gray-200 px-3 py-3 dark:border-gray-700">
                <span className="flex items-start gap-2 text-sm text-gray-800 dark:text-gray-100">
                  <CheckCircleIcon ok={result.passed} />
                  <span className="min-w-0">{result.name}</span>
                </span>
                <div className="flex items-center justify-between gap-1.5 pl-7">
                  <span
                    className={`flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${SEVERITY_PILL_STYLE[result.severity]}`}
                  >
                    {SEVERITY_ICON[result.severity]} {SEVERITY_LABEL[result.severity]}
                  </span>
                  {!result.passed && result.detail.nodeIds && result.detail.nodeIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onFocusNodes(result.detail.nodeIds ?? [])}
                      className="shrink-0 whitespace-nowrap rounded border border-gray-300 px-1.5 py-1 text-[11px] text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
                    >
                      캔버스에서 보기
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2.5 rounded-xl bg-indigo-50/60 p-3 dark:bg-indigo-950/30">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">이 요소로 실험해 보기</p>
        {/* B8: USER(입구) 노드는 "장애"라는 개념이 없어서 "사용자 장애 주입"처럼 뜻이 안 통하는 버튼
            대신, 실제 현재 값 기준 "트래픽 급증" 하나만 보여준다(일반 "트래픽 2배"와 중복이라 뺌). */}
        {elementInfo.type === "USER" ? (
          <button
            type="button"
            onClick={onGoToExperiment}
            className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-950"
          >
            ↗ 트래픽 급증{" "}
            {elementInfo.entryAvgRps !== undefined && `(예: ${elementInfo.entryAvgRps} → ${elementInfo.entryAvgRps * 2} RPS)`}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={onGoToExperiment}
              className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              ⚡ {elementInfo.label} 장애 주입
            </button>
            <button
              type="button"
              onClick={onGoToExperiment}
              className="flex items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-700 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-blue-950"
            >
              ↗ 트래픽 2배로 늘려 보기
            </button>
          </>
        )}
        {COST_RELEVANT_TYPES.includes(elementInfo.type) && (
          <WhatIfRemovePanel architectureId={architectureId} graph={graph} nodeId={elementInfo.id} nodeLabel={elementInfo.label} />
        )}
      </div>
    </div>
  );
}
