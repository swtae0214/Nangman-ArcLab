import { Module } from '@nestjs/common';
import { ArchitectureModule } from '../architecture/architecture.module.js';
import { ValidationController } from './validation.controller.js';
import { ValidationService } from './validation.service.js';

@Module({
  imports: [ArchitectureModule],
  controllers: [ValidationController],
  providers: [ValidationService],
  exports: [ValidationService],
})
export class ValidationModule {}
