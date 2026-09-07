import { Module } from '@nestjs/common';
import { ArchitectureController } from './architecture.controller.js';
import { ArchitectureService } from './architecture.service.js';
import { ShareController } from './share.controller.js';

@Module({
  controllers: [ArchitectureController, ShareController],
  providers: [ArchitectureService],
  exports: [ArchitectureService],
})
export class ArchitectureModule {}
