import { randomUUID } from 'node:crypto';
import type { ArchitectureModel } from '../../generated/prisma/models.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ArchitectureDetail, ArchitectureGraph, ArchitectureSummary, ShareArchitectureResponse } from '@nangman/shared-types';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateArchitectureDto } from './dto/create-architecture.dto.js';
import { UpdateArchitectureDto } from './dto/update-architecture.dto.js';

const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

@Injectable()
export class ArchitectureService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ownerToken: string, dto: CreateArchitectureDto): Promise<ArchitectureDetail> {
    const created = await this.prisma.architecture.create({
      data: {
        ownerToken,
        name: dto.name,
        graphJson: dto.graph as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDetail(created);
  }

  async listByOwner(ownerToken: string): Promise<ArchitectureSummary[]> {
    const rows = await this.prisma.architecture.findMany({
      where: { ownerToken },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toSummary(row));
  }

  /** owner 본인이거나, 공개(is_public)된 아키텍처만 조회 가능 (4/5단계 권한 규칙) */
  async getOneForOwnerOrPublic(id: string, ownerToken: string): Promise<ArchitectureDetail> {
    const row = await this.findOrThrow(id);
    if (row.ownerToken !== ownerToken && !row.isPublic) {
      throw new ForbiddenException('이 아키텍처에 접근할 권한이 없습니다.');
    }
    return this.toDetail(row);
  }

  /** POST 계열(시뮬레이션 실행 등)에서 재사용 — owner 본인이 아니면 무조건 거부한다. */
  async getOwned(id: string, ownerToken: string): Promise<ArchitectureDetail> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, ownerToken);
    return this.toDetail(row);
  }

  async update(id: string, ownerToken: string, dto: UpdateArchitectureDto): Promise<ArchitectureDetail> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, ownerToken);

    const updated = await this.prisma.architecture.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.graph !== undefined ? { graphJson: dto.graph as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    return this.toDetail(updated);
  }

  async remove(id: string, ownerToken: string): Promise<{ id: string }> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, ownerToken);
    await this.prisma.architecture.delete({ where: { id } });
    return { id };
  }

  /** 공유 링크를 새로 발급(또는 재발급)하고 공개로 전환한다. owner만 가능. */
  async share(id: string, ownerToken: string): Promise<ShareArchitectureResponse> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, ownerToken);

    const shareToken = randomUUID();
    await this.prisma.architecture.update({
      where: { id },
      data: { shareToken, isPublic: true },
    });

    return { shareToken, shareUrl: `${process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN}/shared/${shareToken}` };
  }

  /** 공유를 해제한다 (비공개로 전환 + 기존 링크 무효화). owner만 가능. */
  async unshare(id: string, ownerToken: string): Promise<{ id: string }> {
    const row = await this.findOrThrow(id);
    this.assertOwner(row, ownerToken);

    await this.prisma.architecture.update({
      where: { id },
      data: { shareToken: null, isPublic: false },
    });
    return { id };
  }

  /**
   * 공유 링크로만 접근하는 완전 공개 조회 — owner_token 없이도 열람 가능해야 하므로
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

  /** POST/PATCH/DELETE는 share_token 공개 여부와 무관하게 owner만 가능 (5-1단계에서 짚은 보안 규칙) */
  private assertOwner(row: ArchitectureModel, ownerToken: string): void {
    if (row.ownerToken !== ownerToken) {
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
}
