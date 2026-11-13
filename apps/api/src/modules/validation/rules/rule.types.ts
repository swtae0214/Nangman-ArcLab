export interface RuleEvaluation {
  ruleCode: string;
  passed: boolean;
  /** 이 규칙이 다루는 컴포넌트가 그래프에 아예 없으면 false — "통과"가 아니라 "해당 없음"으로 표시된다. */
  applicable: boolean;
  detail: { nodeIds?: string[] };
}
