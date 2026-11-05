import type { ArchitectureDashboardSummary, ArchitectureDetail, ShareArchitectureResponse } from '@nangman/shared-types';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUserId } from '../../common/decorators/current-user.decorator.js';
import { AuthGuard } from '../../common/guards/auth.guard.js';
import { ArchitectureService } from './architecture.service.js';
import { CreateArchitectureDto } from './dto/create-architecture.dto.js';
import { UpdateArchitectureDto } from './dto/update-architecture.dto.js';

@UseGuards(AuthGuard)
@Controller('architectures')
export class ArchitectureController {
  constructor(private readonly architectureService: ArchitectureService) {}

  @Post()
  create(@CurrentUserId() userId: string, @Body() dto: CreateArchitectureDto): Promise<ArchitectureDetail> {
    return this.architectureService.create(userId, dto);
  }

  @Get()
  list(@CurrentUserId() userId: string): Promise<ArchitectureDashboardSummary[]> {
    return this.architectureService.listByOwner(userId);
  }

  @Get(':id')
  getOne(@CurrentUserId() userId: string, @Param('id') id: string): Promise<ArchitectureDetail> {
    return this.architectureService.getOneForOwnerOrPublic(id, userId);
  }

  @Patch(':id')
  update(
    @CurrentUserId() userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateArchitectureDto,
  ): Promise<ArchitectureDetail> {
    return this.architectureService.update(id, userId, dto);
  }

  @Delete(':id')
  remove(@CurrentUserId() userId: string, @Param('id') id: string): Promise<{ id: string }> {
    return this.architectureService.remove(id, userId);
  }

  @Post(':id/share')
  share(@CurrentUserId() userId: string, @Param('id') id: string): Promise<ShareArchitectureResponse> {
    return this.architectureService.share(id, userId);
  }

  @Delete(':id/share')
  unshare(@CurrentUserId() userId: string, @Param('id') id: string): Promise<{ id: string }> {
    return this.architectureService.unshare(id, userId);
  }
}
