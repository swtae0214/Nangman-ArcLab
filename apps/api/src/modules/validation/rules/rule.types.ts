export interface RuleEvaluation {
  ruleCode: string;
  passed: boolean;
  detail: { nodeIds?: string[] };
}
