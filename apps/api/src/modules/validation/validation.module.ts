import { Module } from '@nestjs/common';
import { ArchitectureModule } from '../architecture/architecture.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ValidationController } from './validation.controller.js';
import { ValidationService } from './validation.service.js';

@Module({
  imports: [ArchitectureModule, CatalogModule],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
