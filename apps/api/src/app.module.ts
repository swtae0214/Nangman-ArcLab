import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArchitectureModule } from './modules/architecture/architecture.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { SimulationModule } from './modules/simulation/simulation.module.js';
import { ValidationModule } from './modules/validation/validation.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 120;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: RATE_LIMIT_WINDOW_MS, limit: RATE_LIMIT_MAX_REQUESTS }]),
    PrismaModule,
    AuthModule,
    ArchitectureModule,
    ValidationModule,
    CatalogModule,
    SimulationModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
