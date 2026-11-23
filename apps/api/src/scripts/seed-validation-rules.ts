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
    description: 'DB Primary/Aurora/DocumentDB만 있고 읽기 확장용 복제본이 없으면 읽기 트래픽을 분산할 수 없습니다.',
    defaultSeverity: 'INFO',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 7',
    category: 'RELIABILITY',
  },
  {
    code: 'NAT-001',
    name: 'NAT Gateway 이중화 여부',
    description: 'NAT Gateway가 1개뿐이면 그 가용 영역(또는 NAT Gateway 자체)에 장애가 났을 때 아웃바운드 트래픽이 전부 끊깁니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 10',
    category: 'RELIABILITY',
  },
  {
    code: 'FARGATE-001',
    name: 'Fargate 컨테이너의 이중화 여부',
    description: 'Fargate 컨테이너가 ECS 서비스로 묶여 있고, 그 안에 최소 2개 이상 배치되어 있는지 확인합니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 7',
    category: 'RELIABILITY',
  },
  {
    code: 'APPRUNNER-001',
    name: 'App Runner의 최소 인스턴스 수',
    description: 'App Runner의 최소 인스턴스 수(min size)가 2 미만이면 인스턴스 하나에 장애가 났을 때 서비스가 끊길 수 있습니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 7',
    category: 'RELIABILITY',
  },
  {
    code: 'QUEUE-001',
    name: '큐/스트림 적체 위험',
    description: 'SQS/Kinesis Data Streams의 유입 속도가 컨슈머 처리 능력을 넘으면 메시지가 쌓이기 시작합니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Reliability Pillar REL 7',
    category: 'RELIABILITY',
  },
  {
    code: 'SEC-001',
    name: '데이터 저장소의 Public Subnet 노출 여부',
    description: 'DB(Primary/Replica), Aurora, DocumentDB, Redshift, OpenSearch, DynamoDB가 Public Subnet 안에 직접 배치되어 있으면 인터넷에서 접근 가능한 경로가 생깁니다.',
    defaultSeverity: 'CRITICAL',
    sourceCitation: 'AWS Well-Architected Framework Security Pillar SEC05-BP01',
    category: 'SECURITY',
  },
  {
    code: 'SEC-002',
    name: '진입점의 WAF 보호 여부',
    description: '로드밸런서/API Gateway(또는 그 앞의 CDN)에 WAF가 연결되어 있지 않으면 SQL 인젝션 같은 흔한 웹 공격을 막을 수 없습니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Security Pillar SEC05-BP03',
    category: 'SECURITY',
  },
  {
    code: 'SEC-003',
    name: '데이터 저장소의 KMS 암호화 연결 여부',
    description: 'RDS/OpenSearch/DocumentDB는 저장 시 암호화를 직접 켜야 합니다 — KMS가 연결되어 있지 않으면 평문으로 저장되고 있을 수 있습니다.',
    defaultSeverity: 'WARNING',
    sourceCitation: 'AWS Well-Architected Framework Security Pillar SEC08-BP02',
    category: 'SECURITY',
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
