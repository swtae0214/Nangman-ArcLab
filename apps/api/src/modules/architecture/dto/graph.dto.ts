import { COMPONENT_TYPES, type ComponentType } from '@nangman/shared-types';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsNumber, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class PositionDto {
  @IsNumber()
  x!: number;

  @IsNumber()
  y!: number;
}

export class NodeDataDto {
  @IsString()
  @MaxLength(100)
  label!: string;

  @IsOptional()
  @IsString()
  presetCode?: string;
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
