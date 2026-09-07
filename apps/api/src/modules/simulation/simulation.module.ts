import { Module } from '@nestjs/common';
import { ArchitectureModule } from '../architecture/architecture.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ValidationModule } from '../validation/validation.module.js';
import { SimulationController } from './simulation.controller.js';
import { SimulationRunController } from './simulation-run.controller.js';
import { SimulationService } from './simulation.service.js';

@Module({
  imports: [ArchitectureModule, ValidationModule, CatalogModule],
  controllers: [SimulationController, SimulationRunController],
  providers: [SimulationService],
})
export class SimulationModule {}
