import { IsInt, IsNumber, IsString, Min } from 'class-validator';

export class NodeCapacityPreviewDto {
  @IsString()
  presetCode!: string;

  @IsInt()
  @Min(1)
  instanceCount!: number;

  @IsNumber()
  @Min(0)
  expectedRps!: number;
}
