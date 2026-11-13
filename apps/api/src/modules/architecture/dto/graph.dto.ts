import { COMPONENT_TYPES, type ComponentType } from '@nangman/shared-types';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

const TEXT_BOX_FONT_SIZES = ['sm', 'md', 'lg'] as const;

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
