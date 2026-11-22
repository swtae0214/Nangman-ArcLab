"use client";

import type { ReactNode } from "react";
import { COMPONENT_META } from "../component-meta";
import type { ArchitectureCostSummary, NodeCostLine } from "../node-cost";

/** 시안(H1)의 주색 — globals.css의 다른 색 토큰과는 별도로, 이 탭의 강조색으로만 쓴다. */
const PRIMARY_COLOR = "#364FC7";

function formatPricingDate(iso?: string): string {
  if (!iso) return "미상";
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

type CellKind = "resolved" | "needs-preset" | "needs-input";

function cellKind(line: NodeCostLine): CellKind {
  if (line.monthlyCostUsd !== undefined) return "resolved";
  if (line.unresolvedReason === "needs-preset") return "needs-preset";
  return "needs-input";
}

/** 8칸(실제로는 lines.length칸) 막대 — 채움/점선 테두리/빗금 세 가지 "모양"으로 상태를 구분한다(색만으로 구분 금지). */
function CostBarCell({ line }: { line: NodeCostLine }) {
  const kind = cellKind(line);
  const title = `${line.label} · ${
    kind === "resolved" ? "반영됨" : kind === "needs-preset" ? "프리셋 필요" : "가격 데이터 준비 중"
  }`;

  if (kind === "resolved") {
    return <div title={title} className="h-2 flex-1 rounded-sm" style={{ backgroundColor: PRIMARY_COLOR }} />;
  }
  if (kind === "needs-preset") {
    return <div title={title} className="h-2 flex-1 rounded-sm border border-dashed border-gray-400 dark:border-gray-500" />;
  }
  return (
    <div
      title={title}
      className="h-2 flex-1 rounded-sm border border-gray-300 dark:border-gray-600"
      style={{
        backgroundImage: "repeating-linear-gradient(45deg, var(--hatch-color, #d1d5db) 0, var(--hatch-color, #d1d5db) 1.5px, transparent 1.5px, transparent 4px)",
      }}
    />
  );
}

function CostGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function ResolvedRow({
  line,
  onToggleAlbPartialCost,
}: {
  line: NodeCostLine;
  onToggleAlbPartialCost: (nodeId: string, next: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700">
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800 dark:text-gray-100">{line.label}</p>
        <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
          {line.presetDisplayName ?? COMPONENT_META[line.type].label}
          {line.isPartial && line.partialNote && (
            <span className="ml-1.5 rounded bg-amber-50 px-1 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {line.partialNote}
            </span>
          )}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="font-medium text-gray-700 dark:text-gray-200">월 ${line.monthlyCostUsd!.toFixed(2)}</span>
        {line.isPartial && line.type === "LOAD_BALANCER" && (
          <button
            type="button"
            onClick={() => onToggleAlbPartialCost(line.nodeId, false)}
            className="whitespace-nowrap rounded border border-gray-300 px-1.5 py-0.5 text-[10px] text-gray-500 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-400 dark:hover:border-blue-400 dark:hover:text-blue-400"
          >
            끄기
          </button>
        )}
      </span>
    </li>
  );
}

function UnresolvedRow({
  line,
  actionLabel,
  onAction,
}: {
  line: NodeCostLine;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2 rounded border border-gray-200 px-2.5 py-1.5 text-xs dark:border-gray-700">
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800 dark:text-gray-100">{line.label}</p>
        <p className="truncate text-[11px] text-gray-400 dark:text-gray-500">
          {COMPONENT_META[line.type].label} · {line.unresolvedNote}
        </p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 whitespace-nowrap rounded border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
        >
          {actionLabel}
        </button>
      )}
    </li>
  );
}

/**
 * "예상 비용" 탭 — 트래픽 전파 엔진이 아니라 ArchitectureCanvas가 보내주는 집계 결과(F1)만 그린다.
 * 노드별 월 비용은 프리셋표/사용량 계산에서 나온 값이라, 캔버스 쪽(ArchitectureCanvas)에서 한 번만
 * 계산해 올려보내고(onCostSummaryChange), 이 패널은 받은 값을 보여주기만 한다.
 *
 * F5: 어떤 상태에서도 "일부만 계산된 합계"가 하한값 표기 없이 나오지 않는 게 원칙(문서 A1) — 그래서
 * summary.isLowerBound가 true면 숫자 자체에 "최소"/"이상"을 붙이고, 막대·그룹으로 뭐가 빠졌는지도 보여준다.
 */
export function CostPanel({
  summary,
  onFocusNodes,
  onToggleAlbPartialCost,
}: {
  summary: ArchitectureCostSummary | null;
  onFocusNodes: (nodeIds: string[]) => void;
  onToggleAlbPartialCost: (nodeId: string, next: boolean) => void;
}) {
  if (!summary || summary.lines.length === 0) {
    return (
      <p className="p-3 text-xs text-gray-400 dark:text-gray-500">
        아직 비용을 추정할 수 있는 컴포넌트(웹 서버/DB/캐시/로드밸런서/CDN)가 없어요.
      </p>
    );
  }

  const resolvedLines = summary.lines.filter((line) => line.monthlyCostUsd !== undefined);
  const needsPresetLines = summary.lines.filter((line) => line.unresolvedReason === "needs-preset");
  const needsInputLines = summary.lines.filter((line) => line.unresolvedReason === "needs-input");

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3 dark:bg-gray-900">
      <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">월 예상 비용</span>
          {summary.isLowerBound && (
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              하한값 · 일부만 계산
            </span>
          )}
        </div>
        <p className="mt-1 text-2xl font-semibold" style={{ color: PRIMARY_COLOR }}>
          ${summary.totalMonthlyCostUsd.toFixed(2)}
          {summary.isLowerBound && <span className="ml-1 text-sm font-normal text-gray-500 dark:text-gray-400">이상</span>}
        </p>

        <div className="mt-2 flex gap-0.5">
          {summary.lines.map((line) => (
            <CostBarCell key={line.nodeId} line={line} />
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-500 dark:text-gray-400">
          <span>■ 반영 {resolvedLines.length}</span>
          <span>▫ 프리셋 필요 {needsPresetLines.length}</span>
          <span>▦ 준비 중 {needsInputLines.length}</span>
        </div>

        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          가격 기준일 {formatPricingDate(summary.pricingFetchedAt)} · {summary.pricingRegion ?? "리전 미상"} · 온디맨드. 빠진
          항목이 채워지면 이 값이 올라가요.
        </p>
      </div>

      {resolvedLines.length > 0 && (
        <CostGroup title={`반영됨 · ${resolvedLines.length}`}>
          {resolvedLines.map((line) => (
            <ResolvedRow key={line.nodeId} line={line} onToggleAlbPartialCost={onToggleAlbPartialCost} />
          ))}
        </CostGroup>
      )}

      {needsPresetLines.length > 0 && (
        <CostGroup title={`프리셋을 고르면 계산돼요 · ${needsPresetLines.length}`}>
          {needsPresetLines.map((line) => (
            <UnresolvedRow key={line.nodeId} line={line} actionLabel="프리셋 선택" onAction={() => onFocusNodes([line.nodeId])} />
          ))}
        </CostGroup>
      )}

      {needsInputLines.length > 0 && (
        <CostGroup title={`가격 데이터가 아직 없어요 · ${needsInputLines.length}`}>
          {needsInputLines.map((line) =>
            line.type === "LOAD_BALANCER" ? (
              <UnresolvedRow
                key={line.nodeId}
                line={line}
                actionLabel="고정 요금만 반영"
                onAction={() => onToggleAlbPartialCost(line.nodeId, true)}
              />
            ) : (
              <UnresolvedRow key={line.nodeId} line={line} />
            ),
          )}
        </CostGroup>
      )}

      <details className="rounded-lg border border-gray-200 p-2 text-xs dark:border-gray-700">
        <summary className="cursor-pointer font-medium text-gray-600 dark:text-gray-300">계산에 안 들어간 항목</summary>
        <p className="mt-1 text-gray-400 dark:text-gray-500">
          스토리지·IOPS, 데이터 전송(인터넷 아웃바운드 외), NAT 게이트웨이 요금은 아직 반영되지 않았어요.
        </p>
      </details>

      {summary.assumptionUserNodeId && (
        <div className="rounded-lg border border-dashed border-gray-300 p-2 text-[11px] text-gray-500 dark:border-gray-600 dark:text-gray-400">
          <p>
            가정: {summary.assumptionAvgRps ?? "미입력"} RPS · 응답 {summary.assumptionAvgResponseSizeKb}KB
            {summary.assumptionAvgResponseSizeIsDefault && (
              <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 text-gray-500 dark:bg-gray-700 dark:text-gray-400">기본값</span>
            )}
          </p>
          <button
            type="button"
            onClick={() => onFocusNodes([summary.assumptionUserNodeId!])}
            className="mt-1 text-blue-600 hover:underline dark:text-blue-400"
          >
            사용자 노드에서 수정
          </button>
        </div>
      )}
    </div>
  );
}
