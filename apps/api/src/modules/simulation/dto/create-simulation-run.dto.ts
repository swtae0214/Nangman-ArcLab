import { IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSimulationRunDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  targetAvailability!: number;

  @IsNumber()
  @Min(0)
  expectedRps!: number;

  @IsOptional()
  @IsString()
  failureScenarioCode?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  failureDurationSec?: number;

  @IsInt()
  @Min(1)
  observationPeriodSec!: number;
}
