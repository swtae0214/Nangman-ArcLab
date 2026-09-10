import type { RuleSeverity } from "@nangman/shared-types";

/** design_handoff_home_dashboard/README.md 색상 토큰: CRITICAL/WARNING/INFO 텍스트 색과, 그
 *  색을 옅게 깐 테두리/배경 rgba 값. 랜딩의 규칙 칩과 대시보드의 규칙 표/배지가 공유한다. */
export const SEVERITY_TEXT_CLASS: Record<RuleSeverity, string> = {
  CRITICAL: "text-console-critical",
  WARNING: "text-console-warning",
  INFO: "text-console-info",
};

export const SEVERITY_BORDER_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "rgba(255,90,90,.4)",
  WARNING: "rgba(255,200,90,.4)",
  INFO: "rgba(90,209,255,.4)",
};

export const SEVERITY_LABEL: Record<RuleSeverity, string> = {
  CRITICAL: "CRITICAL",
  WARNING: "WARNING",
  INFO: "INFO",
};

/** 위반 규칙 배지/칩의 옅은 배경색. 텍스트는 SEVERITY_TEXT_CLASS를 같이 쓴다. */
export const SEVERITY_BADGE_BG_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "rgba(255,90,90,.15)",
  WARNING: "rgba(255,200,90,.15)",
  INFO: "rgba(90,209,255,.15)",
};
