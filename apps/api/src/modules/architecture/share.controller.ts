import type { ArchitectureDetail } from '@nangman/shared-types';
import { Controller, Get, Param } from '@nestjs/common';
import { ArchitectureService } from './architecture.service.js';

/** 공유 링크 전용, 완전 공개 엔드포인트 — 익명 세션 쿠키가 없어도(=아예 처음 오는 방문자여도) 봐야 한다. */
@Controller('shared')
export class ShareController {
  constructor(private readonly architectureService: ArchitectureService) {}

  @Get(':shareToken')
  getByShareToken(@Param('shareToken') shareToken: string): Promise<ArchitectureDetail> {
    return this.architectureService.getByShareToken(shareToken);
  }
}
