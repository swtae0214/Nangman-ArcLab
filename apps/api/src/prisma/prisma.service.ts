import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Prisma 7부터 PrismaClient는 driver adapter가 필수다 (schema.prisma의
 * datasource url만으로는 더 이상 접속할 수 없음). 로컬 PostgreSQL이므로
 * @prisma/adapter-pg를 쓰고, 연결 문자열은 DATABASE_URL 환경변수를 그대로 넘긴다.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
