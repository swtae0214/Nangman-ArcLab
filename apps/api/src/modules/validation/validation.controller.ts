import type { ArchitectureValidationReport, ValidationPreviewResult } from '@nangman/shared-types';
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { ArchitectureService } from '../architecture/architecture.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { estimateMonthlyCostUsd } from '../catalog/cost.util.js';
import { ValidatePreviewDto } from './dto/validate-preview.dto.js';
import { ValidationService } from './validation.service.js';

@UseGuards(AuthGuard)
@Controller('architectures')
export class ValidationController {
  constructor(
    private readonly architectureService: ArchitectureService,
    private readonly validationService: ValidationService,
    private readonly catalogService: CatalogService,
  ) {}

  @Post(':id/validate')
  async validate(@CurrentUserId() userId: string, @Param('id') id: string): Promise<ArchitectureValidationReport> {
    const architecture = await this.architectureService.getOneForOwnerOrPublic(id, userId);
    return this.validationService.evaluate(architecture.graph);
  }

  /**
   * F3: "빼고 시험해 보기" — 소유권만 확인하고, 저장된 그래프가 아니라 요청 본문으로 받은 가상의
   * 그래프(보통 노드 하나를 뺀 상태)를 그 자리에서 검증·비용 계산만 한다. 아무것도 저장하지 않는다.
   */
  @Post(':id/validate-preview')
  async validatePreview(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: ValidatePreviewDto,
  ): Promise<ValidationPreviewResult> {
    await this.architectureService.getOneForOwnerOrPublic(id, userId);
    const presets = await this.catalogService.listComponentPresets();
    const validation = await this.validationService.evaluate(dto.graph);
    return { validation, estimatedMonthlyCostUsd: estimateMonthlyCostUsd(dto.graph, presets) };
  }
}
