import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ArchitectureGraphDto } from '../../architecture/dto/graph.dto.js';

/** F3: "빼고 시험해 보기" — 저장 없이 가상의 그래프만 검증·비용 계산해 보는 요청 본문. */
export class ValidatePreviewDto {
  @ValidateNested()
  @Type(() => ArchitectureGraphDto)
  graph!: ArchitectureGraphDto;
}
