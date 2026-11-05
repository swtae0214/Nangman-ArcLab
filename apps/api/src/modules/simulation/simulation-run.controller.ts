import type { SimulationRunResult, SimulationRunSummary } from '@nangman/shared-types';
import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { CreateSimulationRunDto } from './dto/create-simulation-run.dto.js';
import { SimulationService } from './simulation.service.js';

/**
 * ArchitectureController/ValidationController와 경로 prefix가 서로 달라(architectures/:id/simulations
 * vs simulations/:runId) 별도 컨트롤러로 뒀다. 5단계 API 설계(5단계 문서)를 그대로 구현한다.
 */
@UseGuards(AuthGuard)
@Controller()
export class SimulationRunController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('architectures/:id/simulations')
  create(
    @CurrentUserId() userId: string,
    @Param('id') architectureId: string,
    @Body() dto: CreateSimulationRunDto,
  ): Promise<SimulationRunResult> {
    return this.simulationService.runSimulation(architectureId, userId, dto);
  }

  @Get('architectures/:id/simulations')
  list(@CurrentUserId() userId: string, @Param('id') architectureId: string): Promise<SimulationRunSummary[]> {
    return this.simulationService.listRuns(architectureId, userId);
  }

  @Get('simulations/:runId')
  getOne(@CurrentUserId() userId: string, @Param('runId') runId: string): Promise<SimulationRunResult> {
    return this.simulationService.getRun(runId, userId);
  }
}
