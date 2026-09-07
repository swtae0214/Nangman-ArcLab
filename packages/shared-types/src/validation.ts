/** validation_rules 테이블(카탈로그)과 정적 검증 엔진 실행 결과가 공유하는 타입. */

export type RuleSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type RuleCategory = 'RELIABILITY' | 'PERFORMANCE';

export interface ValidationRuleCatalogItem {
  code: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  sourceCitation: string;
  category: RuleCategory;
}

export interface ValidationRuleResult {
  ruleCode: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  sourceCitation: string;
  passed: boolean;
  /** 규칙을 위반한 노드 id 목록 (있는 경우). 캔버스에서 해당 노드를 강조 표시하는 데 쓴다. */
  detail: { nodeIds?: string[] };
}

export interface ArchitectureValidationReport {
  passed: boolean;
  results: ValidationRuleResult[];
}
