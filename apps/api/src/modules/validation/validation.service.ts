import type { ArchitectureGraph, ArchitectureValidationReport, ValidationRuleResult } from '@nangman/shared-types';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { evaluateAsgRule } from './rules/asg.rule.js';
import { evaluateDbReplicaRule } from './rules/db-replica.rule.js';
import { evaluateCacheMultiAzRule, evaluateDbMultiAzRule } from './rules/multi-az.rule.js';
import type { RuleEvaluation } from './rules/rule.types.js';
import { evaluateSpofRule } from './rules/spof.rule.js';

/** 탐지 로직은 코드에, 규칙 설명/근거 문구는 DB(validation_rules)에 — 4단계에서 정한 분리 원칙. */
const RULE_EVALUATORS: Array<(graph: ArchitectureGraph) => RuleEvaluation> = [
  evaluateSpofRule,
  evaluateDbMultiAzRule,
  evaluateCacheMultiAzRule,
  evaluateAsgRule,
  evaluateDbReplicaRule,
];

@Injectable()
export class ValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(graph: ArchitectureGraph): Promise<ArchitectureValidationReport> {
    const catalog = await this.prisma.validationRule.findMany();
    const catalogByCode = new Map(catalog.map((rule) => [rule.code, rule]));

    const results: ValidationRuleResult[] = RULE_EVALUATORS.map((evaluateRule) => {
      const evaluation = evaluateRule(graph);
      const rule = catalogByCode.get(evaluation.ruleCode);
      return {
        ruleCode: evaluation.ruleCode,
        name: rule?.name ?? evaluation.ruleCode,
        description: rule?.description ?? '',
        severity: rule?.defaultSeverity ?? 'INFO',
        sourceCitation: rule?.sourceCitation ?? '',
        passed: evaluation.passed,
        detail: evaluation.detail,
      };
    });

    const passed = results.every((result) => result.passed || result.severity !== 'CRITICAL');

    return { passed, results };
  }
}
