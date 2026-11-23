import type { RuleCategory, RuleSeverity } from "@nangman/shared-types";

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

/** 홈 화면 개선(14단계): 영문 "CRITICAL" 그대로 두면 처음 보는 사람이 바로 못 알아봐서 한글로 바꿨다. */
export const SEVERITY_LABEL: Record<RuleSeverity, string> = {
  CRITICAL: "심각",
  WARNING: "경고",
  INFO: "정보",
};

/** 홈 화면 "검증 규칙" 섹션에서 심각도별로 묶을 때, 그 묶음이 왜 중요한지 한 줄로 보여주는 부제. */
export const SEVERITY_SECTION_SUBTITLE: Record<RuleSeverity, string> = {
  CRITICAL: "설계가 멈추거나 데이터가 노출될 수 있어요",
  WARNING: "장애나 공격에 취약해질 수 있어요",
  INFO: "알아 두면 좋은 개선 포인트예요",
};

/** validation.ts의 RuleCategory(RELIABILITY/PERFORMANCE/SECURITY)를 한글 칩 라벨로. */
export const CATEGORY_LABEL: Record<RuleCategory, string> = {
  RELIABILITY: "가용성",
  SECURITY: "보안",
  PERFORMANCE: "용량·성능",
};

export const CATEGORY_ORDER: RuleCategory[] = ["RELIABILITY", "SECURITY", "PERFORMANCE"];

/** 색만으로 구분하지 않도록 라벨 앞에 붙이는 모양 — 에디터 쪽 validation-style.ts와 같은 기호. */
export const SEVERITY_ICON: Record<RuleSeverity, string> = {
  CRITICAL: "◆",
  WARNING: "▲",
  INFO: "●",
};

/** 심각도 순서(심각 → 경고 → 정보) — 규칙 목록을 심각도순으로 정렬할 때 쓴다. */
export const SEVERITY_ORDER: RuleSeverity[] = ["CRITICAL", "WARNING", "INFO"];

/** 위반 규칙 배지/칩의 옅은 배경색. 텍스트는 SEVERITY_TEXT_CLASS를 같이 쓴다. */
export const SEVERITY_BADGE_BG_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "rgba(255,90,90,.15)",
  WARNING: "rgba(255,200,90,.15)",
  INFO: "rgba(90,209,255,.15)",
};
