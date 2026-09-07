import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * 2가지 시나리오만 시딩한다. "AZ 하나 다운"은 실제로는 어느 물리적 AZ에 뭐가 있는지까지
 * 모델링해야 정확하지만, 우리 그래프는 "Multi-AZ 그룹에 속해 있다"는 사실만 표현하므로
 * capacityReductionRatio(절반 상실)로 근사한다 — 완벽히 같은 의미는 아니라는 걸 밝혀둔다.
 */
const FAILURE_SCENARIOS = [
  {
    code: 'AZ_DOWN',
    displayName: '가용 영역(AZ) 하나 다운',
    description:
      'Multi-AZ 또는 Auto Scaling Group 안의 인스턴스 중 절반을 잃는다고 가정합니다 (어느 AZ에 무엇이 있는지까지는 구분하지 않는 근사치입니다).',
    defaultDurationSec: 1800,
    affectsRule: { capacityReductionRatio: 0.5, scope: ['MULTI_AZ_GROUP', 'AUTO_SCALING_GROUP', 'MULTI_REGION_GROUP'] },
  },
  {
    code: 'DB_PRIMARY_DOWN',
    displayName: 'DB Primary 장애',
    description: 'DB Primary가 완전히 사라진 것으로 가정합니다. Replica가 있다면 그쪽으로만 트래픽 경로가 계산됩니다.',
    defaultDurationSec: 600,
    affectsRule: { removeNodeTypes: ['DB_PRIMARY'] },
  },
] as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });

  for (const scenario of FAILURE_SCENARIOS) {
    await prisma.failureScenario.upsert({
      where: { code: scenario.code },
      update: scenario,
      create: scenario,
    });
  }

  console.log(`Seeded ${FAILURE_SCENARIOS.length} failure scenarios.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
