import type { ComponentPresetCatalogItem, FailureScenarioCatalogItem, ValidationRuleCatalogItem } from '@nangman/shared-types';
import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';

/** 참조 데이터라 누구 소유도 아니라서 익명 세션 인증이 필요 없다. */
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('validation-rules')
  listValidationRules(): Promise<ValidationRuleCatalogItem[]> {
    return this.catalogService.listValidationRules();
  }

  @Get('component-presets')
  listComponentPresets(): Promise<ComponentPresetCatalogItem[]> {
    return this.catalogService.listComponentPresets();
  }

  @Get('failure-scenarios')
  listFailureScenarios(): Promise<FailureScenarioCatalogItem[]> {
    return this.catalogService.listFailureScenarios();
  }
}
