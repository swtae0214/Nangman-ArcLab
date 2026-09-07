import type { ArchitectureValidationReport } from '@nangman/shared-types';

/** 6단계: 실패한 검증 규칙을 실제로 뭘 고치면 되는지로 바꿔주는 규칙 기반 매핑. */
const SUGGESTIONS_BY_RULE_CODE: Record<string, string> = {
  'SPOF-001': '단일 장애점으로 지목된 컴포넌트를 이중화하세요 (예: 웹 서버를 Auto Scaling Group에 2대 이상 배치).',
  'MULTIAZ-001': 'DB(Primary/Replica)를 Multi-AZ 그룹 안에 배치해 가용 영역 장애에 대비하세요.',
  'MULTIAZ-002': '캐시도 Multi-AZ 그룹 안에 배치하면 가용 영역 장애 중에도 캐시를 계속 쓸 수 있어요.',
  'ASG-001': '웹 서버를 Auto Scaling Group 안에, 최소 2대 이상 배치하세요.',
  'DB-002': 'DB Replica를 추가하면 읽기 트래픽을 분산할 수 있어요.',
};

/** 실패한 규칙마다 하나씩, 원래 순서(정적 검증 규칙 순서)를 유지해서 개선 제안을 만든다. */
export function generateSuggestions(validation: ArchitectureValidationReport): string[] {
  return validation.results
    .filter((result) => !result.passed)
    .map((result) => SUGGESTIONS_BY_RULE_CODE[result.ruleCode])
    .filter((suggestion): suggestion is string => Boolean(suggestion));
}
