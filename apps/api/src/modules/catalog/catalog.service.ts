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
    return presets.map((preset) => {
      const pricing = this.readPricingMetadata(preset.metadata);
      return {
        code: preset.code,
        componentType: preset.componentType,
        displayName: preset.displayName,
        serviceRateRps: preset.serviceRateRps.toNumber(),
        sourceNote: preset.sourceNote,
        ...pricing,
      };
    });
  }

  /** fetch-aws-pricing 스크립트가 ComponentPreset.metadata(Json)에 적어둔 가격 정보를 꺼낸다. 아직 수집 전이면 빈 객체. */
  private readPricingMetadata(
    metadata: unknown,
  ): Pick<ComponentPresetCatalogItem, 'hourlyUsd' | 'monthlyCostUsd' | 'awsRegion' | 'pricingSourceNote' | 'pricingFetchedAt'> {
    if (typeof metadata !== 'object' || metadata === null) return {};
    const meta = metadata as Record<string, unknown>;
    return {
      ...(typeof meta.hourlyUsd === 'number' ? { hourlyUsd: meta.hourlyUsd } : {}),
      ...(typeof meta.monthlyCostUsd === 'number' ? { monthlyCostUsd: meta.monthlyCostUsd } : {}),
      ...(typeof meta.awsRegion === 'string' ? { awsRegion: meta.awsRegion } : {}),
      ...(typeof meta.pricingSourceNote === 'string' ? { pricingSourceNote: meta.pricingSourceNote } : {}),
      ...(typeof meta.fetchedAt === 'string' ? { pricingFetchedAt: meta.fetchedAt } : {}),
    };
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
