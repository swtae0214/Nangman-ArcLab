import type { ComponentPresetCatalogItem, FailureScenarioCatalogItem, ValidationRuleCatalogItem } from '@nangman/shared-types';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';

/** 참조 데이터(카탈로그) 조회만 담당한다 — 검증 실행(ValidationService)이나 계산(QueueingService)과는 분리. */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listValidationRules(): Promise<ValidationRuleCatalogItem[]> {
    const rules = await this.prisma.validationRule.findMany({ orderBy: { code: 'asc' } });
    return rules.map((rule) => ({
      code: rule.code,
      name: rule.name,
      description: rule.description,
      severity: rule.defaultSeverity,
      sourceCitation: rule.sourceCitation,
      category: rule.category,
    }));
  }

  async listComponentPresets(): Promise<ComponentPresetCatalogItem[]> {
    const presets = await this.prisma.componentPreset.findMany({ orderBy: { code: 'asc' } });
    return presets.map((preset) => ({
      code: preset.code,
      componentType: preset.componentType,
      displayName: preset.displayName,
      serviceRateRps: preset.serviceRateRps.toNumber(),
      sourceNote: preset.sourceNote,
    }));
  }

  async listFailureScenarios(): Promise<FailureScenarioCatalogItem[]> {
    const scenarios = await this.prisma.failureScenario.findMany({ orderBy: { code: 'asc' } });
    return scenarios.map((scenario) => ({
      code: scenario.code,
      displayName: scenario.displayName,
      description: scenario.description,
      defaultDurationSec: scenario.defaultDurationSec,
    }));
  }
}
