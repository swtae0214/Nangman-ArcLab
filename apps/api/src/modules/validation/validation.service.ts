import type { ArchitectureGraph, ArchitectureValidationReport, ValidationRuleResult } from '@nangman/shared-types';
import { Injectable } from '@nestjs/common';
import type { ValidationRuleModel } from '../../generated/prisma/models.js';
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
  /**
   * validation_rules는 런타임에 고치는 화면이 없는 참조 데이터라, API 프로세스가 떠 있는 동안
   * 바뀌지 않는다. 대시보드처럼 아키텍처 여러 개를 한 번에 검증할 때(ArchitectureService가
   * Promise.all로 evaluate()를 동시에 여러 번 부른다) 매번 이 정적 테이블을 다시 읽어오면
   * 낭비라, 값이 아니라 "불러오는 중인 Promise" 자체를 캐싱한다 — 그래야 동시에 들어온 여러
   * 호출도 중복 쿼리 없이 같은 결과를 공유해서 기다린다.
   */
  private catalogPromise: Promise<ValidationRuleModel[]> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async evaluate(graph: ArchitectureGraph): Promise<ArchitectureValidationReport> {
    const catalog = await this.loadCatalog();
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

  private loadCatalog(): Promise<ValidationRuleModel[]> {
    if (!this.catalogPromise) {
      this.catalogPromise = this.prisma.validationRule.findMany().catch((error: unknown) => {
        // 조회가 실패했는데 그 실패까지 캐싱해버리면 DB가 복구돼도 영원히 같은 에러만 반복된다 —
        // 캐시를 비워서 다음 호출이 다시 시도하게 한다.
        this.catalogPromise = null;
        throw error;
      });
    }
    return this.catalogPromise;
  }
}
