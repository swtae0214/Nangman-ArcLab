import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** 2단계에서 설계한 정적 검증 규칙 카탈로그. 탐지 로직은 코드(rules/*.ts)에, 설명·근거는 여기 데이터로 둔다. */
const VALIDATION_RULES = [
  {
    code: 'SPOF-001',
    name: '단일 장애점(SPOF) 탐지',
    description: '제거했을 때 로드밸런서에서 DB로 가는 경로가 완전히 끊기는 컴포넌트가 있는지 확인합니다.',
    defaultSeverity: 'CRITICAL',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 11',
    category: 'RELIABILITY',
  },
  {
    code: 'MULTIAZ-001',
    name: 'DB의 Multi-AZ 구성 여부',
    description: 'DB(Primary/Replica)가 Multi-AZ 또는 Multi-Region 그룹 안에 배치되어 있는지 확인합니다.',
    defaultSeverity: 'CRITICAL',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 10',
    category: 'RELIABILITY',
  },
  {
    code: 'MULTIAZ-002',
    name: '캐시의 Multi-AZ 구성 여부',
    description: '캐시가 Multi-AZ 또는 Multi-Region 그룹 안에 배치되어 있는지 확인합니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 10',
    category: 'RELIABILITY',
  },
  {
    code: 'ASG-001',
    name: '웹 서버 계층의 Auto Scaling 여부',
    description: '웹 서버가 Auto Scaling Group 안에 있고, 그 안에 웹 서버가 최소 2대 이상 배치되어 있는지 확인합니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 7',
    category: 'RELIABILITY',
  },
  {
    code: 'DB-002',
    name: '읽기 확장을 위한 DB Replica 존재 여부',
    description: 'DB Primary만 있고 Replica가 없으면 읽기 트래픽을 분산할 수 없습니다.',
    defaultSeverity: 'INFO',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 7',
    category: 'RELIABILITY',
  },
] as const;

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });

  for (const rule of VALIDATION_RULES) {
    await prisma.validationRule.upsert({
      where: { code: rule.code },
      update: rule,
      create: rule,
    });
  }

  console.log(`Seeded ${VALIDATION_RULES.length} validation rules.`);
  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
