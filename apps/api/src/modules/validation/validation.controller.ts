import type { ArchitectureValidationReport } from '@nangman/shared-types';
import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { OwnerToken } from '../../common/decorators/owner-token.decorator.js';
import { AnonymousSessionGuard } from '../../common/guards/anonymous-session.guard.js';
import { ArchitectureService } from '../architecture/architecture.service.js';
import { ValidationService } from './validation.service.js';

@UseGuards(AnonymousSessionGuard)
@Controller('architectures')
export class ValidationController {
  constructor(
    private readonly architectureService: ArchitectureService,
    private readonly validationService: ValidationService,
  ) {}

  @Post(':id/validate')
  async validate(@OwnerToken() ownerToken: string, @Param('id') id: string): Promise<ArchitectureValidationReport> {
    const architecture = await this.architectureService.getOneForOwnerOrPublic(id, ownerToken);
    return this.validationService.evaluate(architecture.graph);
  }
}
