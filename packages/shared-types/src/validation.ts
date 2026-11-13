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
  /**
   * 11단계: 규칙이 다루는 컴포넌트(DB/캐시/웹 서버 등)가 캔버스에 아예 없으면 false다.
   * 예: DB가 하나도 없는데 "DB의 Multi-AZ 구성 여부"가 초록색 통과로 뜨면, 실제로는 아무것도
   * 검사한 게 아닌데 "문제 없음"으로 오해하게 된다 — 그래서 이 경우는 통과가 아니라 "해당 없음"으로
   * 따로 표시한다. true일 땐 원래대로 passed 값을 본다.
   */
  applicable: boolean;
  /** 규칙을 위반한 노드 id 목록 (있는 경우). 캔버스에서 해당 노드를 강조 표시하는 데 쓴다. */
  detail: { nodeIds?: string[] };
}

export interface ArchitectureValidationReport {
  passed: boolean;
  results: ValidationRuleResult[];
}
