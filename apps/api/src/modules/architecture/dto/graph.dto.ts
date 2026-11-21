import { COMPONENT_TYPES, type ComponentType } from '@nangman/shared-types';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

const TEXT_BOX_FONT_SIZES = ['sm', 'md', 'lg'] as const;
const TRAFFIC_EDGE_KINDS = ['distribution', 'call', 'replication'] as const;

export class PositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class NodeDataDto {
  @IsString()
  // 11단계: TEXT_BOX(자유 텍스트 주석)는 리소스 이름보다 긴 메모를 담을 수 있어야 해서 넉넉하게 늘렸다.
  @MaxLength(500)
  label!: string;

  @IsOptional()
  @IsString()
  presetCode?: string;

  @IsOptional()
  @IsIn(TEXT_BOX_FONT_SIZES)
  fontSize?: (typeof TEXT_BOX_FONT_SIZES)[number];

  // 13단계: 트래픽 전파 — 이 노드를 "윗단과 끊어진 별도 입구"로 취급하는 직접 지정 RPS.
  @IsOptional()
  @IsNumber()
  trafficOverrideRps?: number;

  // 13단계: USER(입구) 노드 전용 — 평상시 평균 RPS / 피크 배수.
  @IsOptional()
  @IsNumber()
  entryAvgRps?: number;

  @IsOptional()
  @IsNumber()
  entryPeakMultiplier?: number;

  // F4: USER(입구) 노드 전용 — CDN/LOAD_BALANCER 사용량 기반 비용 계산이 공통으로 쓰는 평균 응답 크기(KB).
  @IsOptional()
  @IsNumber()
  entryAvgResponseSizeKb?: number;

  // F4: CDN(CloudFront) 전용 — 캐시 적중률(%).
  @IsOptional()
  @IsNumber()
  cdnCacheHitRatioPercent?: number;

  // F4: LOAD_BALANCER(ALB) 전용 — 연결 재사용(keep-alive) 여부 / 연결당 평균 요청 수.
  @IsOptional()
  @IsBoolean()
  albConnectionReuse?: boolean;

  @IsOptional()
  @IsNumber()
  albRequestsPerConnection?: number;

  // F4: 프리셋 선택 가능 타입 전용 — 같은 프리셋을 몇 대 쓰는지(용량 계산 + 비용 둘 다에 쓰임).
  @IsOptional()
  @IsNumber()
  instanceCount?: number;
}

export class GraphNodeDto {
  @IsString()
  id!: string;

  @IsIn(COMPONENT_TYPES)
  type!: ComponentType;

  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  logicalGroupId?: string;

  @IsOptional()
  @IsNumber()
  zOrderBias?: number;

  @ValidateNested()
  @Type(() => NodeDataDto)
  data!: NodeDataDto;
}

export class GraphEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  // 13단계: 엣지 종류는 보통 저장하지 않고 매번 추정한다 — 그 추정이 틀렸을 때만 사용자가 직접 골라 저장한다.
  @IsOptional()
  @IsIn(TRAFFIC_EDGE_KINDS)
  trafficKindOverride?: (typeof TRAFFIC_EDGE_KINDS)[number];

  @IsOptional()
  @IsNumber()
  distributionWeight?: number;

  @IsOptional()
  @IsNumber()
  callsPerRequest?: number;
}

export class ArchitectureGraphDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphNodeDto)
  nodes!: GraphNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraphEdgeDto)
  edges!: GraphEdgeDto[];
}
