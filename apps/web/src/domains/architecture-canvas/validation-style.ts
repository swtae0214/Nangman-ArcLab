import type { ComponentType, RuleSeverity } from "@nangman/shared-types";

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
  "DB-002": ["DB_PRIMARY", "DB_REPLICA"],
  "MULTIAZ-001": ["DB_PRIMARY", "DB_REPLICA", "REDSHIFT", "OPENSEARCH"],
  "MULTIAZ-002": ["CACHE"],
  "ASG-001": ["WEB_SERVER", "ECS", "ELASTIC_BEANSTALK"],
  "NAT-001": ["NAT_GATEWAY"],
  "FARGATE-001": ["FARGATE"],
  "APPRUNNER-001": ["APP_RUNNER"],
};
