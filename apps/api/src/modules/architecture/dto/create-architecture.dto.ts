import { Type } from 'class-transformer';
import { IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { ArchitectureGraphDto } from './graph.dto.js';

export class CreateArchitectureDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ValidateNested()
  @Type(() => ArchitectureGraphDto)
  graph!: ArchitectureGraphDto;
}
