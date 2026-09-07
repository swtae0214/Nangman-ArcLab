import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const ESTIMATE_NOTE =
  '교육용 추정치입니다. AWS가 공식적으로 "인스턴스 1대당 초당 요청 수"를 규격화해 발표하지 않기 때문에, ' +
  '이 값은 상대적인 크기 비교(작음/중간/큼)를 위한 단순화된 값이며 실제 처리량은 애플리케이션 로직에 따라 크게 달라집니다.';

const COMPONENT_PRESETS = [
  { code: 'ec2-t3-medium', componentType: 'WEB_SERVER', displayName: 'EC2 t3.medium (2 vCPU)', serviceRateRps: 150 },
  { code: 'ec2-m5-large', componentType: 'WEB_SERVER', displayName: 'EC2 m5.large (2 vCPU)', serviceRateRps: 300 },
  { code: 'ec2-c5-xlarge', componentType: 'WEB_SERVER', displayName: 'EC2 c5.xlarge (4 vCPU)', serviceRateRps: 600 },
  { code: 'rds-primary-db-t3-medium', componentType: 'DB_PRIMARY', displayName: 'RDS db.t3.medium', serviceRateRps: 80 },
  { code: 'rds-primary-db-m5-large', componentType: 'DB_PRIMARY', displayName: 'RDS db.m5.large', serviceRateRps: 200 },
  { code: 'rds-replica-db-t3-medium', componentType: 'DB_REPLICA', displayName: 'RDS Read Replica db.t3.medium', serviceRateRps: 80 },
  { code: 'rds-replica-db-m5-large', componentType: 'DB_REPLICA', displayName: 'RDS Read Replica db.m5.large', serviceRateRps: 200 },
  { code: 'elasticache-cache-t3-micro', componentType: 'CACHE', displayName: 'ElastiCache cache.t3.micro', serviceRateRps: 5000 },
  { code: 'elasticache-cache-m5-large', componentType: 'CACHE', displayName: 'ElastiCache cache.m5.large', serviceRateRps: 20000 },
] as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });

  for (const preset of COMPONENT_PRESETS) {
    const data = { ...preset, sourceNote: ESTIMATE_NOTE, metadata: {} };
    await prisma.componentPreset.upsert({
      where: { code: preset.code },
      update: data,
      create: data,
    });
  }

  console.log(`Seeded ${COMPONENT_PRESETS.length} component presets.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
