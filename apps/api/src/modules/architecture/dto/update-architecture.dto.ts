import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ArchitectureGraphDto } from './graph.dto.js';

export class UpdateArchitectureDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ArchitectureGraphDto)
  graph?: ArchitectureGraphDto;
}
