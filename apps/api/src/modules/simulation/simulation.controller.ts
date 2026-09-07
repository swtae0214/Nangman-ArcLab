import type { NodeCapacityPreviewResult } from '@nangman/shared-types';
import { Body, Controller, Post } from '@nestjs/common';
import { NodeCapacityPreviewDto } from './dto/node-capacity-preview.dto.js';
import { SimulationService } from './simulation.service.js';

/**
 * 그래프 전체를 도는 시뮬레이션 엔진(5주차 예정)이 나오기 전, 단일 노드의 M/M/c 계산만
 * 미리 검증해볼 수 있는 엔드포인트. 특정 아키텍처에 속하지 않는 계산기라 소유권 검사가 필요 없다.
 */
@Controller('simulate')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('node-capacity-preview')
  preview(@Body() dto: NodeCapacityPreviewDto): Promise<NodeCapacityPreviewResult> {
    return this.simulationService.previewNodeCapacity(dto.presetCode, dto.instanceCount, dto.expectedRps);
  }
}
