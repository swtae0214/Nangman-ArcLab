import type { ArchitectureValidationReport } from '@nangman/shared-types';
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { ArchitectureService } from '../architecture/architecture.service.js';
import { ValidationService } from './validation.service.js';

@UseGuards(AuthGuard)
@Controller('architectures')
export class ValidationController {
  constructor(
    private readonly architectureService: ArchitectureService,
    private readonly validationService: ValidationService,
  ) {}

  @Post(':id/validate')
  async validate(@CurrentUserId() userId: string, @Param('id') id: string): Promise<ArchitectureValidationReport> {
    const architecture = await this.architectureService.getOneForOwnerOrPublic(id, userId);
    return this.validationService.evaluate(architecture.graph);
  }
}
