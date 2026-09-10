import { Module } from '@nestjs/common';
import { ValidationService } from '../validation/validation.service.js';
import { ArchitectureController } from './architecture.controller.js';
import { ArchitectureService } from './architecture.service.js';
import { ShareController } from './share.controller.js';

/**
 * ValidationModule이 이미 ArchitectureModule을 import하고 있어서(ValidationController가
 * architectureService.getOneForOwnerOrPublic을 쓰려고), 여기서 ValidationModule을 다시
 * import하면 순환 의존이 생긴다. ValidationService 자체는 PrismaService(전역 모듈)만 필요로
 * 하는 가벼운 서비스라, 클래스만 provider로 등록해서 순환을 피한다.
 */
@Module({
  controllers: [ArchitectureController, ShareController],
  providers: [ArchitectureService, ValidationService],
  exports: [ArchitectureService],
})
export class ArchitectureModule {}
