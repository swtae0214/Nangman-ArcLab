import type { ComponentType, RuleSeverity, ValidationRuleResult } from "@nangman/shared-types";

/**
 * 홈 화면 개선 다음 단계(우측 패널 정합성, P1): 백엔드의 report.passed는 "CRITICAL만 전부 통과하면
 * true"라서, WARNING/INFO 위반이 있어도 "통과"로 뜬다 — 헤더 칩과 배너가 서로 다른 기준을 쓰면서
 * "통과"라는데 목록엔 위반이 떠 있는 모순이 생겼다. report.passed는 쓰지 말고, results 배열에서
 * 직접 파생한 이 값 하나를 헤더 칩·배너·그룹 요약이 전부 같이 쓴다.
 */
export interface ValidationSummary {
  applicableCount: number;
  passedCount: number;
  violatedCount: number;
  notApplicableCount: number;
  /** 위반이 하나도 없으면 null. 있으면 그중 가장 심각한 등급(CRITICAL > WARNING > INFO). */
  worstSeverity: RuleSeverity | null;
}

export function summarizeValidationResults(results: ValidationRuleResult[]): ValidationSummary {
  const applicable = results.filter((result) => result.applicable);
  const violated = applicable.filter((result) => !result.passed);
  let worstSeverity: RuleSeverity | null = null;
  for (const severity of SEVERITY_ORDER) {
    if (violated.some((result) => result.severity === severity)) {
      worstSeverity = severity;
      break;
    }
  }
  return {
    applicableCount: applicable.length,
    passedCount: applicable.length - violated.length,
    violatedCount: violated.length,
    notApplicableCount: results.length - applicable.length,
    worstSeverity,
  };
}

/** ValidationResultList와 SelectionDetailPanel이 같이 쓰는 심각도별 색/라벨. */
export const SEVERITY_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  WARNING: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  INFO: "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export const SEVERITY_DOT_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-amber-500",
  INFO: "bg-blue-500",
};

/** B6: "CRITICAL" 같은 영문 대문자 그대로 보이던 걸 한글로 — 색만으로 구분하지 않고 글자로도 구분되게. */
export const SEVERITY_LABEL: Record<RuleSeverity, string> = {
  CRITICAL: "심각",
  WARNING: "경고",
  INFO: "정보",
};

export const SEVERITY_ORDER: RuleSeverity[] = ["CRITICAL", "WARNING", "INFO"];

/** 요소 상세 패널의 심각도 "알약" 배지 — 배경/글자색. */
export const SEVERITY_PILL_STYLE: Record<RuleSeverity, string> = {
  CRITICAL: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
  WARNING: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-300",
  INFO: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300",
};

export const SEVERITY_ICON: Record<RuleSeverity, string> = {
  CRITICAL: "◆",
  WARNING: "▲",
  INFO: "●",
};

/**
 * 정적 검증 탭 시각 처리 정리(V1): 그룹 헤더의 "알약 칩" 색 — 디자인 문서가 준 정확한 헥스값.
 * 다크모드 변형은 문서에 없어서 라이트모드 값을 그대로 쓴다(필요하면 나중에 다크모드 값을 받아야 함).
 */
export const GROUP_CHIP_STYLE: Record<RuleSeverity, { color: string; backgroundColor: string }> = {
  CRITICAL: { color: "#B42318", backgroundColor: "#FEE4E2" },
  WARNING: { color: "#92400E", backgroundColor: "#FEF0C7" },
  INFO: { color: "#175CD3", backgroundColor: "#E4EEFC" },
};

/**
 * V5: 위반 행의 배경/테두리색(글자는 기본 텍스트색을 쓰고 색은 여기에만 쓴다). INFO 위반의 색은
 * 디자인 문서에 없어서, 그룹 칩과 같은 계열로 추정해 만들었다 — 확인 필요.
 */
export const VIOLATED_ROW_STYLE: Record<RuleSeverity, { backgroundColor: string; borderColor: string }> = {
  CRITICAL: { backgroundColor: "#FFF3F2", borderColor: "#F1B7B2" },
  WARNING: { backgroundColor: "#FFFBF0", borderColor: "#F3D9A4" },
  INFO: { backgroundColor: "#EDF4FE", borderColor: "#BBD2F5" },
};

/** V5: 통과 규칙을 펼쳤을 때만 입히는 배경/테두리(접혀 있을 때는 중립색 그대로). */
export const PASSED_EXPANDED_ROW_STYLE = { backgroundColor: "#F3FBF7", borderColor: "#BFE6D2" };

/** V4: 상태 아이콘 색. */
export const STATUS_ICON_COLOR = {
  passed: "#2BBF7E",
  violatedWarning: "#F79009",
  violatedCritical: "#D92D20",
  violatedInfo: "#175CD3",
  notApplicable: "#A9B3C4",
} as const;

/**
 * 각 검증 규칙(apps/api의 rules/*.rule.ts)이 "다루는" 컴포넌트 타입.
 * 백엔드는 실패했을 때만 detail.nodeIds를 채우기 때문에(통과하면 빈 배열), 통과한 규칙까지
 * "이 요소와 관련된 검증"에 보여주려면 nodeIds와 별개로 규칙↔타입 관계를 따로 알고 있어야 한다.
 */
export const RULE_RELATED_COMPONENT_TYPES: Record<string, ComponentType[]> = {
  "SPOF-001": [
    "LOAD_BALANCER",
    "API_GATEWAY",
    "DB_PRIMARY",
    "DB_REPLICA",
    "AURORA",
    "DOCUMENT_DB",
    "REDSHIFT",
    "OPENSEARCH",
    "DYNAMODB",
  ],
  "DB-002": ["DB_PRIMARY", "DB_REPLICA", "AURORA", "AURORA_REPLICA", "DOCUMENT_DB", "DOCUMENT_DB_REPLICA"],
  "MULTIAZ-001": ["DB_PRIMARY", "DB_REPLICA", "REDSHIFT", "OPENSEARCH"],
  "MULTIAZ-002": ["CACHE"],
  "ASG-001": ["WEB_SERVER", "ECS", "ELASTIC_BEANSTALK"],
  "NAT-001": ["NAT_GATEWAY"],
  "FARGATE-001": ["FARGATE"],
  "APPRUNNER-001": ["APP_RUNNER"],
  "QUEUE-001": ["SQS", "KINESIS_DATA_STREAMS"],
  "SEC-001": ["DB_PRIMARY", "DB_REPLICA", "AURORA", "AURORA_REPLICA", "DOCUMENT_DB", "DOCUMENT_DB_REPLICA", "REDSHIFT", "OPENSEARCH", "DYNAMODB"],
  "SEC-002": ["LOAD_BALANCER", "API_GATEWAY"],
  "SEC-003": ["DB_PRIMARY", "DB_REPLICA", "OPENSEARCH", "DOCUMENT_DB", "DOCUMENT_DB_REPLICA"],
};
