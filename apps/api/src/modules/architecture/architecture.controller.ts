import type { ArchitectureDetail, ArchitectureSummary, ShareArchitectureResponse } from '@nangman/shared-types';
import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { OwnerToken } from '../../common/decorators/owner-token.decorator.js';
import { AnonymousSessionGuard } from '../../common/guards/anonymous-session.guard.js';
import { ArchitectureService } from './architecture.service.js';
import { CreateArchitectureDto } from './dto/create-architecture.dto.js';
import { UpdateArchitectureDto } from './dto/update-architecture.dto.js';

@UseGuards(AnonymousSessionGuard)
@Controller('architectures')
export class ArchitectureController {
  constructor(private readonly architectureService: ArchitectureService) {}

  @Post()
  create(@OwnerToken() ownerToken: string, @Body() dto: CreateArchitectureDto): Promise<ArchitectureDetail> {
    return this.architectureService.create(ownerToken, dto);
  }

  @Get()
  list(@OwnerToken() ownerToken: string): Promise<ArchitectureSummary[]> {
    return this.architectureService.listByOwner(ownerToken);
  }

  @Get(':id')
  getOne(@OwnerToken() ownerToken: string, @Param('id') id: string): Promise<ArchitectureDetail> {
    return this.architectureService.getOneForOwnerOrPublic(id, ownerToken);
  }

  @Patch(':id')
  update(
    @OwnerToken() ownerToken: string,
    @Param('id') id: string,
    @Body() dto: UpdateArchitectureDto,
  ): Promise<ArchitectureDetail> {
    return this.architectureService.update(id, ownerToken, dto);
  }

  @Delete(':id')
  remove(@OwnerToken() ownerToken: string, @Param('id') id: string): Promise<{ id: string }> {
    return this.architectureService.remove(id, ownerToken);
  }

  @Post(':id/share')
  share(@OwnerToken() ownerToken: string, @Param('id') id: string): Promise<ShareArchitectureResponse> {
    return this.architectureService.share(id, ownerToken);
  }

  @Delete(':id/share')
  unshare(@OwnerToken() ownerToken: string, @Param('id') id: string): Promise<{ id: string }> {
    return this.architectureService.unshare(id, ownerToken);
  }
}
