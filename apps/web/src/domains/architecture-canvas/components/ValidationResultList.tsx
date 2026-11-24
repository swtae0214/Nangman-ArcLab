"use client";

import type { ArchitectureValidationReport, RuleSeverity, ValidationRuleResult } from "@nangman/shared-types";
import type { CSSProperties } from "react";
import { useState } from "react";
import {
  GROUP_CHIP_STYLE,
  PASSED_EXPANDED_ROW_STYLE,
  SEVERITY_ICON,
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SEVERITY_STYLE,
  summarizeValidationResults,
  VIOLATED_ROW_STYLE,
} from "../validation-style";
import { ChevronIcon, ValidationStatusIcon, type ValidationRowStatus } from "./ValidationStatusIcon";

interface ValidationResultListProps {
  report: ArchitectureValidationReport;
  /** 마지막으로 검증을 실행한 시각(react-query의 dataUpdatedAt) — "방금 전 검증" 같은 문구에 쓴다. */
  checkedAt?: number;
  /** "캔버스에서 보기"를 누르면 그 규칙이 지목한 노드들을 선택하고 화면에 맞춰 보여준다. */
  onFocusNodes?: (nodeIds: string[]) => void;
  /** 하단 "다음으로 실험해보기" 버튼 — 지금은 시뮬레이션 탭으로만 이동시킨다(구체적인 시나리오 자동 실행 연결은 추후 작업). */
  onGoToExperiment?: () => void;
}

function formatElapsed(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  return `${diffHour}시간 전`;
}

function rowStatus(result: ValidationRuleResult): ValidationRowStatus {
  if (result.passed) return "passed";
  if (result.severity === "CRITICAL") return "violated-critical";
  if (result.severity === "WARNING") return "violated-warning";
  return "violated-info";
}

/**
 * V3/V4/V5/V6/V7: 통과 행은 보통(400) 굵기·중립색, 위반 행은 굵게(700)·기본 텍스트색(색은 아이콘/
 * 테두리/배경에만) + 심각도별 배경색(심각만 왼쪽 4px 강조선 추가). 펼쳤을 때 버튼은 심각 위반만
 * 채움(파랑), 나머지는 외곽선.
 *
 * V8(문제/방향, 확인한 것/결과 구조화 문구)은 아직 데이터에 없는 필드라 보류 — 지금은 기존
 * description 하나를 그대로 보여준다.
 */
function ValidationItem({
  result,
  isOpen,
  onToggle,
  onFocusNodes,
}: {
  result: ValidationRuleResult;
  isOpen: boolean;
  onToggle: () => void;
  onFocusNodes?: (nodeIds: string[]) => void;
}) {
  const nodeIds = result.detail.nodeIds ?? [];
  const status = rowStatus(result);

  const rowStyle: CSSProperties | undefined = result.passed
    ? isOpen
      ? { backgroundColor: PASSED_EXPANDED_ROW_STYLE.backgroundColor, borderColor: PASSED_EXPANDED_ROW_STYLE.borderColor }
      : undefined
    : {
        backgroundColor: VIOLATED_ROW_STYLE[result.severity].backgroundColor,
        borderColor: VIOLATED_ROW_STYLE[result.severity].borderColor,
        ...(result.severity === "CRITICAL" ? { borderLeftWidth: 4, borderLeftColor: "#D92D20" } : {}),
      };

  return (
    <div
      style={rowStyle}
      className={`rounded-md border px-3 py-2 text-sm text-gray-800 dark:text-gray-100 ${
        result.passed && !isOpen ? "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800" : ""
      }`}
    >
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 text-left">
        <ValidationStatusIcon status={status} />
        <span
          className={`min-w-0 flex-1 text-[13px] leading-[18px] ${result.passed ? "font-normal" : "font-bold"}`}
          style={{ wordBreak: "keep-all" }}
        >
          {result.name}
        </span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      {isOpen && (
        <div className="mt-1.5 pl-[26px]">
          <p className="text-xs opacity-80">{result.description}</p>
          {!result.passed && nodeIds.length > 0 && onFocusNodes && (
            <button
              type="button"
              onClick={() => onFocusNodes(nodeIds)}
              className={
                result.severity === "CRITICAL"
                  ? "mt-1.5 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                  : "mt-1.5 rounded-md border border-blue-600 bg-white px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:bg-gray-900"
              }
            >
              캔버스에서 확인 →
            </button>
          )}
          <p className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">{result.ruleCode}</p>
        </div>
      )}
    </div>
  );
}

export function ValidationResultList({ report, checkedAt, onFocusNodes, onGoToExperiment }: ValidationResultListProps) {
  const [openedCode, setOpenedCode] = useState<string | null>(null);
  const [collapsedOverrides, setCollapsedOverrides] = useState<ReadonlySet<RuleSeverity>>(() => new Set());
  const [openedPassedBundles, setOpenedPassedBundles] = useState<ReadonlySet<RuleSeverity>>(() => new Set());
  const [isNotApplicableOpen, setIsNotApplicableOpen] = useState(false);

  // P1: report.passed 대신, results에서 직접 파생한 이 요약 하나를 배너·그룹 요약이 같이 쓴다.
  const summary = summarizeValidationResults(report.results);
  const notApplicableResults = report.results.filter((result) => !result.applicable);

  const subtitleParts: string[] = [];
  if (checkedAt) subtitleParts.push(`${formatElapsed(checkedAt)} 검증`);
  if (notApplicableResults.length > 0) subtitleParts.push(`해당 없음 ${notApplicableResults.length}개는 제외했어요`);
  const subtitle =
    summary.violatedCount === 0
      ? `${summary.applicableCount}개 규칙을 모두 통과했어요${subtitleParts.length > 0 ? ` · ${subtitleParts.join(" · ")}` : ""}`
      : subtitleParts.join(" · ");

  const groups = SEVERITY_ORDER.map((severity) => {
    const applicable = report.results.filter((result) => result.severity === severity && result.applicable);
    const violated = applicable.filter((result) => !result.passed);
    const passed = applicable.filter((result) => result.passed);
    return { severity, violated, passed, applicableCount: applicable.length, violatedCount: violated.length };
  }).filter((group) => group.applicableCount > 0);

  const toggleGroupCollapsed = (severity: RuleSeverity) => {
    setCollapsedOverrides((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  const togglePassedBundle = (severity: RuleSeverity) => {
    setOpenedPassedBundles((current) => {
      const next = new Set(current);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        <div
          className={`rounded-md border px-3 py-2 text-sm ${
            summary.worstSeverity
              ? SEVERITY_STYLE[summary.worstSeverity]
              : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          }`}
        >
          <p className="font-semibold">
            {summary.worstSeverity ? `${SEVERITY_ICON[summary.worstSeverity]} ` : "✓ "}
            {summary.applicableCount}개 중 {summary.passedCount}개 통과
            {summary.worstSeverity && ` · ${SEVERITY_LABEL[summary.worstSeverity]} ${summary.violatedCount}개`}
          </p>
          {subtitle && <p className="mt-0.5 text-xs opacity-80">{subtitle}</p>}
        </div>

        {groups.map((group) => {
          const defaultCollapsed = group.violatedCount === 0;
          const isCollapsed = collapsedOverrides.has(group.severity) ? !defaultCollapsed : defaultCollapsed;
          const isPassedBundleOpen = openedPassedBundles.has(group.severity);
          return (
            <div key={group.severity} className="flex flex-col gap-2">
              {/* V1: 색 점 + 모양 글자가 따로 떠 있던 걸 알약 칩 하나로 합쳤다. */}
              <button type="button" onClick={() => toggleGroupCollapsed(group.severity)} className="flex w-full items-center gap-2 text-left">
                <span
                  style={GROUP_CHIP_STYLE[group.severity]}
                  className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                >
                  {SEVERITY_ICON[group.severity]} {SEVERITY_LABEL[group.severity]}
                </span>
                <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                  {group.violatedCount === 0
                    ? `${group.applicableCount}개 모두 통과`
                    : `${group.applicableCount}개 중 ${group.violatedCount}개 위반`}
                </span>
                <span className="ml-auto">
                  <ChevronIcon isOpen={!isCollapsed} />
                </span>
              </button>
              {!isCollapsed && (
                <ul className="flex flex-col gap-2">
                  {group.violated.map((result) => (
                    <li key={result.ruleCode}>
                      <ValidationItem
                        result={result}
                        isOpen={openedCode === result.ruleCode}
                        onToggle={() => setOpenedCode((current) => (current === result.ruleCode ? null : result.ruleCode))}
                        onFocusNodes={onFocusNodes}
                      />
                    </li>
                  ))}
                  {/* V2: 위반이 있는 그룹에서는 통과한 규칙을 한 줄로 접어 둔다 — 첫 시선이 위반 행에 가게. */}
                  {group.passed.length > 0 &&
                    (group.violatedCount > 0 ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => togglePassedBundle(group.severity)}
                          className="flex w-full items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
                        >
                          <span>통과한 규칙 {group.passed.length}개</span>
                          <span className="ml-auto">
                            <ChevronIcon isOpen={isPassedBundleOpen} />
                          </span>
                        </button>
                        {isPassedBundleOpen && (
                          <ul className="mt-2 flex flex-col gap-2">
                            {group.passed.map((result) => (
                              <li key={result.ruleCode}>
                                <ValidationItem
                                  result={result}
                                  isOpen={openedCode === result.ruleCode}
                                  onToggle={() => setOpenedCode((current) => (current === result.ruleCode ? null : result.ruleCode))}
                                  onFocusNodes={onFocusNodes}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ) : (
                      group.passed.map((result) => (
                        <li key={result.ruleCode}>
                          <ValidationItem
                            result={result}
                            isOpen={openedCode === result.ruleCode}
                            onToggle={() => setOpenedCode((current) => (current === result.ruleCode ? null : result.ruleCode))}
                            onFocusNodes={onFocusNodes}
                          />
                        </li>
                      ))
                    ))}
                </ul>
              )}
            </div>
          );
        })}

        {notApplicableResults.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setIsNotApplicableOpen((current) => !current)}
              className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-left text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400"
            >
              <ValidationStatusIcon status="not-applicable" size={16} />
              <span>해당 없음 {notApplicableResults.length}개</span>
              <span className="ml-auto">
                <ChevronIcon isOpen={isNotApplicableOpen} />
              </span>
            </button>
            {isNotApplicableOpen && (
              <ul className="mt-1.5 flex flex-col gap-1.5 pl-3">
                {notApplicableResults.map((result) => (
                  <li key={result.ruleCode} className="flex items-start gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                    <ValidationStatusIcon status="not-applicable" size={14} />
                    <span className="mt-0.5">{result.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {onGoToExperiment && (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-gray-200 p-3 dark:border-gray-700">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">다음으로 실험해 보기</p>
          {/* V6: 채움 버튼은 심각 위반 전용 — 이 둘은 보조 동작이라 연한 파랑 바탕 + 파랑 글자/테두리. */}
          <button
            type="button"
            onClick={onGoToExperiment}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-left text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            ⚡ AZ 장애 주입해보기
          </button>
          <button
            type="button"
            onClick={onGoToExperiment}
            className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-left text-xs font-medium text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
          >
            ↗ 트래픽 2배로 늘려 보기
          </button>
        </div>
      )}
    </div>
  );
}
