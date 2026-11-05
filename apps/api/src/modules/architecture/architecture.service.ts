import { randomUUID } from 'node:crypto';
import type { ArchitectureModel } from '../../generated/prisma/models.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  ArchitectureDashboardSummary,
  ArchitectureDetail,
  ArchitectureGraph,
  ArchitectureSummary,
  ShareArchitectureResponse,
} from '@nangman/shared-types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ValidationService } from '../validation/validation.service.js';
import { summarizeLatestSimulationRun, summarizeValidation } from './dashboard-stats.util.js';
import { CreateArchitectureDto } from './dto/create-architecture.dto.js';
import { UpdateArchitectureDto } from './dto/update-architecture.dto.js';

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

@Injectable()
export class ArchitectureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validationService: ValidationService,
  ) {}

  async create(userId: string, dto: CreateArchitectureDto): Promise<ArchitectureDetail> {
    const created = await this.prisma.architecture.create({
      data: {
        userId,
        name: dto.name,
        graphJson: dto.graph as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDetail(created);
  }

  /** 홈 대시보드용 — 카드마다 실시간 정적 검증 + 가장 최근 시뮬레이션 실행 결과를 함께 내려준다. */
  async listByOwner(userId: string): Promise<ArchitectureDashboardSummary[]> {
    const rows = await this.prisma.architecture.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return Promise.all(rows.map((row) => this.toDashboardSummary(row)));
  }

  /** 본인 소유이거나, 공개(is_public)된 아키텍처만 조회 가능 (4/5단계 권한 규칙) */
  async getOneForOwnerOrPublic(id: string, userId: string): Promise<ArchitectureDetail> {
    const row = await this.findOrThrow(id);
    if (row.userId !== userId && !row.isPublic) {
      throw new ForbiddenException('이 아키텍처에 접근할 권한이 없습니다.');
    }
    return this.toDetail(row);
  }

  /** POST 계열(시뮬레이션 실행 등)에서 재사용 — 본인 소유가 아니면 무조건 거부한다. */
  async getOwned(id: string, userId: string): Promise<ArchitectureDetail> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, userId);
    return this.toDetail(row);
  }

  async update(id: string, userId: string, dto: UpdateArchitectureDto): Promise<ArchitectureDetail> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, userId);

    const updated = await this.prisma.architecture.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.graph !== undefined ? { graphJson: dto.graph as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    return this.toDetail(updated);
  }

  async remove(id: string, userId: string): Promise<{ id: string }> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, userId);
    await this.prisma.architecture.delete({ where: { id } });
    return { id };
  }

  /** 공유 링크를 새로 발급(또는 재발급)하고 공개로 전환한다. 본인 소유만 가능. */
  async share(id: string, userId: string): Promise<ShareArchitectureResponse> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, userId);

    const shareToken = randomUUID();
    await this.prisma.architecture.update({
      where: { id },
      data: { shareToken, isPublic: true },
    });

    return { shareToken, shareUrl: `${process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN}/shared/${shareToken}` };
  }

  /** 공유를 해제한다 (비공개로 전환 + 기존 링크 무효화). 본인 소유만 가능. */
  async unshare(id: string, userId: string): Promise<{ id: string }> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, userId);

    await this.prisma.architecture.update({
      where: { id },
      data: { shareToken: null, isPublic: false },
    });
    return { id };
  }

  /**
   * 공유 링크로만 접근하는 완전 공개 조회 — 로그인 없이도 열람 가능해야 하므로
   * getOneForOwnerOrPublic과 달리 소유권 검사를 아예 하지 않는다. is_public이 꺼져 있으면
   * (해제되었거나 애초에 공유된 적 없으면) 존재 자체를 알려주지 않고 404로 처리한다.
   */
  async getByShareToken(shareToken: string): Promise<ArchitectureDetail> {
    const row = await this.prisma.architecture.findUnique({ where: { shareToken } });
    if (!row || !row.isPublic) {
      throw new NotFoundException('공유된 아키텍처를 찾을 수 없습니다.');
    }
    return this.toDetail(row);
  }

  private async findOrThrow(id: string): Promise<ArchitectureModel> {
    const row = await this.prisma.architecture.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('아키텍처를 찾을 수 없습니다.');
    }
    return row;
  }

  /** POST/PATCH/DELETE는 share_token 공개 여부와 무관하게 본인 소유만 가능 (5-1단계에서 짚은 보안 규칙) */
  private assertOwner(row: ArchitectureModel, userId: string): void {
    if (row.userId !== userId) {
      throw new ForbiddenException('이 아키텍처를 수정할 권한이 없습니다.');
    }
  }

  private toSummary(row: ArchitectureModel): ArchitectureSummary {
    return {
      id: row.id,
      name: row.name,
      isPublic: row.isPublic,
      shareToken: row.shareToken ?? undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toDetail(row: ArchitectureModel): ArchitectureDetail {
    return {
      ...this.toSummary(row),
      graph: row.graphJson as unknown as ArchitectureGraph,
    };
  }

  private async toDashboardSummary(row: ArchitectureModel): Promise<ArchitectureDashboardSummary> {
    const graph = row.graphJson as unknown as ArchitectureGraph;

    const [validationReport, latestRun] = await Promise.all([
      this.validationService.evaluate(graph),
      this.prisma.simulationRun.findFirst({
        where: { architectureId: row.id },
        orderBy: { createdAt: 'desc' },
        include: { simulationMetrics: true },
      }),
    ]);

    return {
      ...this.toSummary(row),
      nodeCount: graph.nodes.length,
      validation: summarizeValidation(validationReport),
      latestSimulation: latestRun ? summarizeLatestSimulationRun(latestRun) : null,
    };
  }
}
