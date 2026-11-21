import 'dotenv/config';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * AWS Price List Bulk API에서 EC2/RDS/ElastiCache의 온디맨드 시간당 요금을 받아와서
 * component_presets.metadata에 "월 비용(730시간 기준)"으로 채워 넣는다.
 *
 * Bulk API의 리전별 파일 하나가 수백 MB(EC2)~수십 MB(RDS)라서, 통째로 JSON.parse하지 않고
 * 한 줄씩 스트리밍으로 읽는다 — products 구역에서는 원하는 인스턴스 타입(+필터 조건)에 맞는
 * SKU만 기억해두고, terms.OnDemand 구역에서는 그 SKU들의 시간당 요금만 뽑는다.
 *
 * 실행: pnpm --filter @nangman/api exec tsx src/scripts/fetch-aws-pricing.ts
 */

const AWS_REGION = 'us-east-1';
const HOURS_PER_MONTH = 730;
const PRICING_BASE = 'https://pricing.us-east-1.amazonaws.com';

interface PresetPricingTarget {
  presetCode: string;
  service: 'AmazonEC2' | 'AmazonRDS' | 'AmazonElastiCache';
  /** products.*.attributes.instanceType과 비교할 값 (예: "t3.medium", "db.m5.large", "cache.t3.micro"). */
  instanceType: string;
  /** 이 서비스의 상품을 걸러내는 추가 조건 — 전부 맞아야 "이 프리셋이 찾는 그 상품"으로 본다. */
  attributeFilters: Record<string, string>;
}

const PRICING_TARGETS: PresetPricingTarget[] = [
  {
    presetCode: 'ec2-t3-medium',
    service: 'AmazonEC2',
    instanceType: 't3.medium',
    attributeFilters: { operatingSystem: 'Linux', tenancy: 'Shared', preInstalledSw: 'NA', capacitystatus: 'Used', licenseModel: 'No License required' },
  },
  {
    presetCode: 'ec2-m5-large',
    service: 'AmazonEC2',
    instanceType: 'm5.large',
    attributeFilters: { operatingSystem: 'Linux', tenancy: 'Shared', preInstalledSw: 'NA', capacitystatus: 'Used', licenseModel: 'No License required' },
  },
  {
    presetCode: 'ec2-c5-xlarge',
    service: 'AmazonEC2',
    instanceType: 'c5.xlarge',
    attributeFilters: { operatingSystem: 'Linux', tenancy: 'Shared', preInstalledSw: 'NA', capacitystatus: 'Used', licenseModel: 'No License required' },
  },
  // RDS는 Primary/Replica 둘 다 같은 인스턴스 클래스를 쓰니, DB 엔진은 가장 흔한 MySQL 기준으로
  // 하나만 가져와서 두 프리셋에 같이 쓴다. Single-AZ 요금이다 — Multi-AZ 묶기는 우리 쪽에서 레플리카를
  // 별도 인스턴스로 이미 표현하고 있어서(복제 화살표), AWS의 "Multi-AZ RDS" 기능 요금과는 별개다.
  {
    presetCode: 'rds-primary-db-t3-medium',
    service: 'AmazonRDS',
    instanceType: 'db.t3.medium',
    attributeFilters: { databaseEngine: 'MySQL', deploymentOption: 'Single-AZ', licenseModel: 'No license required' },
  },
  {
    presetCode: 'rds-primary-db-m5-large',
    service: 'AmazonRDS',
    instanceType: 'db.m5.large',
    attributeFilters: { databaseEngine: 'MySQL', deploymentOption: 'Single-AZ', licenseModel: 'No license required' },
  },
  {
    presetCode: 'rds-replica-db-t3-medium',
    service: 'AmazonRDS',
    instanceType: 'db.t3.medium',
    attributeFilters: { databaseEngine: 'MySQL', deploymentOption: 'Single-AZ', licenseModel: 'No license required' },
  },
  {
    presetCode: 'rds-replica-db-m5-large',
    service: 'AmazonRDS',
    instanceType: 'db.m5.large',
    attributeFilters: { databaseEngine: 'MySQL', deploymentOption: 'Single-AZ', licenseModel: 'No license required' },
  },
  {
    presetCode: 'elasticache-cache-t3-micro',
    service: 'AmazonElastiCache',
    instanceType: 'cache.t3.micro',
    attributeFilters: { cacheEngine: 'Redis' },
  },
  {
    presetCode: 'elasticache-cache-m5-large',
    service: 'AmazonElastiCache',
    instanceType: 'cache.m5.large',
    attributeFilters: { cacheEngine: 'Redis' },
  },
];

async function fetchRegionFileUrl(offerCode: string): Promise<string> {
  const res = await fetch(`${PRICING_BASE}/offers/v1.0/aws/${offerCode}/current/region_index.json`);
  const body = (await res.json()) as { regions: Record<string, { currentVersionUrl: string }> };
  const entry = body.regions[AWS_REGION];
  if (!entry) throw new Error(`${offerCode}: ${AWS_REGION} 리전 가격 파일을 못 찾았어요.`);
  return `${PRICING_BASE}${entry.currentVersionUrl}`;
}

async function downloadToTempFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`다운로드 실패: ${url} (${res.status})`);
  const fs = await import('node:fs/promises');
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}

/**
 * 한 서비스의 가격 파일을 한 줄씩 읽어서, targets에 걸린 instanceType+필터 조건에 맞는 SKU의
 * 온디맨드 시간당 요금(USD)을 뽑는다. 파일 전체를 메모리에 안 올리고 스트리밍으로 처리한다.
 */
async function extractHourlyPrices(filePath: string, targets: PresetPricingTarget[]): Promise<Map<string, number>> {
  // instanceType(+필터)별로 어떤 프리셋을 찾는 건지 매핑해둔다 — 같은 instanceType을 여러 프리셋이
  // 공유할 수 있어서(RDS Primary/Replica), "매치된 sku -> 그 instanceType"만 일단 기억해두고,
  // 나중에 가격을 알아내면 그 instanceType을 쓰는 모든 프리셋에 같이 채운다.
  const skuToInstanceType = new Map<string, string>();
  const instanceTypeToPrice = new Map<string, number>();

  let section: 'before' | 'products' | 'terms' = 'before';
  let currentSku: string | null = null;
  let currentAttrs: Record<string, string> = {};
  let inAttributes = false;
  let currentTermsSku: string | null = null;

  const rl = createInterface({ input: createReadStream(filePath, { encoding: 'utf-8' }) });

  for await (const line of rl) {
    if (section === 'before' && line === '  "products" : {') {
      section = 'products';
      continue;
    }
    if (section === 'products' && line === '  "terms" : {') {
      section = 'terms';
      continue;
    }

    if (section === 'products') {
      const skuMatch = /^ {4}"([A-Z0-9]+)" : \{$/.exec(line);
      if (skuMatch) {
        currentSku = skuMatch[1];
        currentAttrs = {};
        continue;
      }
      if (line === '      "attributes" : {') {
        inAttributes = true;
        continue;
      }
      if (inAttributes) {
        if (line.startsWith('      }')) {
          inAttributes = false;
          // attributes 블록이 끝난 시점에 이 상품이 우리가 찾는 조건과 맞는지 확인한다.
          if (currentSku) {
            for (const target of targets) {
              if (currentAttrs.instanceType !== target.instanceType) continue;
              const matchesFilters = Object.entries(target.attributeFilters).every(([key, value]) => currentAttrs[key] === value);
              if (matchesFilters) {
                skuToInstanceType.set(currentSku, target.instanceType);
              }
            }
          }
          continue;
        }
        const attrMatch = /^\s*"([^"]+)" : "([^"]*)"/.exec(line);
        if (attrMatch) currentAttrs[attrMatch[1]] = attrMatch[2];
      }
      continue;
    }

    if (section === 'terms') {
      const termsSkuMatch = /^ {6}"([A-Z0-9]+)" : \{$/.exec(line);
      if (termsSkuMatch) {
        currentTermsSku = skuToInstanceType.has(termsSkuMatch[1]) ? termsSkuMatch[1] : null;
        continue;
      }
      if (currentTermsSku) {
        const instanceType = skuToInstanceType.get(currentTermsSku);
        if (instanceType && !instanceTypeToPrice.has(instanceType)) {
          const priceMatch = /^\s*"USD" : "([0-9.]+)"/.exec(line);
          if (priceMatch) {
            instanceTypeToPrice.set(instanceType, Number(priceMatch[1]));
            currentTermsSku = null; // 이 SKU는 다 찾았으니 다음 줄부터는 새 sku를 기다린다
          }
        }
      }
    }
  }

  return instanceTypeToPrice;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs/promises');

  const services: PresetPricingTarget['service'][] = ['AmazonEC2', 'AmazonRDS', 'AmazonElastiCache'];
  const priceByInstanceType = new Map<string, number>();

  for (const service of services) {
    const tempPath = path.join(os.tmpdir(), `${service}-${AWS_REGION}.json`);
    const url = await fetchRegionFileUrl(service);
    console.log(`[${service}] 가격 파일 받는 중... (${url})`);
    await downloadToTempFile(url, tempPath);

    const targets = PRICING_TARGETS.filter((target) => target.service === service);
    const prices = await extractHourlyPrices(tempPath, targets);
    for (const [instanceType, hourly] of prices) priceByInstanceType.set(`${service}:${instanceType}`, hourly);

    await fs.unlink(tempPath).catch(() => undefined);
    console.log(`[${service}] ${prices.size}개 인스턴스 타입 요금 추출 완료`);
  }

  const fetchedAt = new Date().toISOString();
  for (const target of PRICING_TARGETS) {
    const hourlyUsd = priceByInstanceType.get(`${target.service}:${target.instanceType}`);
    if (hourlyUsd === undefined) {
      console.warn(`⚠️ ${target.presetCode}(${target.instanceType}) 가격을 못 찾았어요 — metadata를 안 건드려요.`);
      continue;
    }
    const monthlyCostUsd = Math.round(hourlyUsd * HOURS_PER_MONTH * 100) / 100;
    await prisma.componentPreset.update({
      where: { code: target.presetCode },
      data: {
        metadata: {
          monthlyCostUsd,
          hourlyUsd,
          awsRegion: AWS_REGION,
          hoursPerMonth: HOURS_PER_MONTH,
          fetchedAt,
          pricingSourceNote: 'AWS Price List Bulk API (온디맨드, 교육용 근사치 — 실제 청구와 다를 수 있어요)',
        },
      },
    });
    console.log(`${target.presetCode}: $${hourlyUsd}/hr -> 월 $${monthlyCostUsd}`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
