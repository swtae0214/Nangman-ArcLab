/**
 * apps/web(React Flow)와 apps/api(NestJS) 양쪽이 공유하는 아키텍처 그래프 타입.
 * 백엔드는 class-validator DTO로, 프론트는 이 타입 + zod로 각자 검증하되
 * "필드 이름과 모양"만 이 파일을 기준으로 맞춘다 (검증 로직 자체는 공유하지 않음).
 */

import type { RuleSeverity } from './validation.js';

/**
 * 배열로 먼저 정의하는 이유: class-validator의 @IsIn()이 실행 시점에 검사할
 * 실제 값 목록을 필요로 하기 때문. TS의 union 타입만으로는 런타임 검증이 불가능해서,
 * "값 목록"을 유일한 원천으로 두고 타입은 여기서 파생시킨다.
 */
export const COMPONENT_TYPES = [
  // 핵심 인프라 — 2/3단계 정적 검증·시뮬레이션 엔진이 계산에 사용하는 컴포넌트
  // 11단계: 사용자(User)는 트래픽의 시작점을 표시하는 용도라 계산 대상은 아니지만(isSimulated:
  // false), 파이프라인을 그릴 때 "어디서부터 흐르는지" 보여주는 게 유용하다는 피드백으로 추가.
  'USER',
  'LOAD_BALANCER',
  'WEB_SERVER',
  'DB_PRIMARY',
  'DB_REPLICA',
  'CACHE',
  'CDN',
  'AUTO_SCALING_GROUP',
  'MULTI_AZ_GROUP',
  'MULTI_REGION_GROUP',
  /** AWS 의미 없이 그냥 "여러 개를 하나로 묶기"만 하는 범용 그룹 (워드/파워포인트의 개체 묶기와 동일) */
  'GENERIC_GROUP',
  // 네트워킹 — 시각적 컴포넌트 (검증/시뮬레이션 엔진은 아직 이 타입들을 계산에 포함하지 않음)
  'VPN_GATEWAY',
  'DIRECT_CONNECT',
  'TRANSIT_GATEWAY',
  'NAT_GATEWAY',
  'INTERNET_GATEWAY',
  // 엣지/보안 — 시각적 컴포넌트
  'WAF',
  'SHIELD',
  'API_GATEWAY',
  'ROUTE53',
  // 컴퓨트/메시징 확장 — 시각적 컴포넌트
  'LAMBDA',
  'SQS',
  'SNS',
  'S3',
  // 9단계: Region>AZ>VPC>Subnet처럼 겹쳐서 그리는 경계 상자 — 전부 시각적 컴포넌트(그룹)
  'REGION',
  'AWS_CLOUD',
  'VPC',
  'PUBLIC_SUBNET',
  'PRIVATE_SUBNET',
  'AVAILABILITY_ZONE',
  'CORPORATE_DATACENTER',
  // 9단계: IoT/스트리밍, CI/CD 파이프라인류 참고 아키텍처에 나온 서비스 — 시각적 컴포넌트
  'IOT_CORE',
  'KINESIS_DATA_STREAMS',
  'KINESIS_DATA_FIREHOSE',
  'AURORA',
  'COGNITO',
  'DOCUMENT_DB',
  'CODEPIPELINE',
  'CODEBUILD',
  'CLOUDFORMATION',
  'CLOUDWATCH',
  'PARAMETER_STORE',
  // 10단계: reel-gen류 서버리스/컨테이너 파이프라인 아키텍처에 나온 서비스.
  'FARGATE',
  'ECR',
  'SECRETS_MANAGER',
  /**
   * 9단계: Target Group처럼 "물리적으로 다른 컨테이너(서브넷 등)에 속한 노드들을 경계를 가로질러
   * 하나로 묶어 보여주는" 논리적 그룹. REGION/VPC/Subnet 같은 물리적 그룹(parentId로 실제 소속을
   * 바꿈)과 달리, 멤버 노드의 parentId는 그대로 두고 data.logicalGroupId만 표시로 붙인다.
   */
  'TARGET_GROUP',
  /** 11단계: 리소스에 안 걸린 자유 텍스트 — 다이어그램에 제목/설명을 달 때 쓰는 순수 주석용 노드. */
  'TEXT_BOX',
] as const;

export type ComponentType = (typeof COMPONENT_TYPES)[number];

export interface GraphNode {
  id: string;
  type: ComponentType;
  position: { x: number; y: number };
  /** 이 노드가 속한 그룹(ASG/Multi-AZ 등) 노드의 id. 최상위 노드는 undefined. */
  parentId?: string;
  /** 9단계: 그룹 노드를 중첩하거나 사용자가 직접 리사이즈했을 때의 크기. 리프 노드는 보통 안 씀. */
  width?: number;
  height?: number;
  /**
   * 9단계: 이 노드가 속한 논리적 그룹(TARGET_GROUP)의 id. parentId(물리적 소속)와는 별개다 —
   * 예를 들어 Public Subnet 1의 웹 서버와 Public Subnet 2의 웹 서버가 서로 다른 parentId를
   * 가지면서도 같은 logicalGroupId를 공유해, 하나의 Target Group으로 함께 표시될 수 있다.
   */
  logicalGroupId?: string;
  /**
   * 10단계: 같은 z-index 등급(같은 깊이의 물리 컨테이너끼리, 혹은 리프 노드끼리) 안에서 어떤 걸
   * 위로 둘지 사용자가 직접 정하는 보정값. "앞으로 가져오기/뒤로 보내기" 버튼으로 ±1씩 바뀐다.
   */
  zOrderBias?: number;
  data: {
    label: string;
    /** component_presets 카탈로그의 code (예: "ec2-t3-medium") */
    presetCode?: string;
    /** 11단계: TEXT_BOX 전용 — 글자 크기. 다른 타입은 항상 비워둔다. */
    fontSize?: 'sm' | 'md' | 'lg';
  };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** 10단계: 연결선 위에 다는 설명 텍스트 (예: "이미지 업로드", "폴링"). 없으면 라벨 없이 그려진다. */
  label?: string;
}

export interface ArchitectureGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ArchitectureSummary {
  id: string;
  name: string;
  isPublic: boolean;
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArchitectureDetail extends ArchitectureSummary {
  graph: ArchitectureGraph;
}

/** 홈 대시보드 카드에 쓰는 요약 통계. 정적 검증은 항상 최신 그래프 기준으로 실시간 계산하고,
 *  가용성/지연시간은 그 아키텍처의 가장 최근 시뮬레이션 실행 기록에서 가져온다(실행한 적이
 *  없으면 latestSimulation이 null). */
export interface ArchitectureFailedRule {
  ruleCode: string;
  name: string;
  severity: RuleSeverity;
}

export interface ArchitectureValidationSummary {
  passed: boolean;
  /** 정적 검증 규칙 카탈로그 총 개수(현재 5개) — "통과 · 규칙 N/5" 배지에 쓴다. */
  totalCount: number;
  failedCount: number;
  worstSeverity: RuleSeverity | null;
  /** 홈 대시보드의 "아키텍처별 위반 규칙" 패널에 쓰는, 실제로 위반한 규칙 목록. */
  failedRules: ArchitectureFailedRule[];
}

export interface ArchitectureLatestSimulationSummary {
  estimatedAvailabilityPercent: number;
  /** 큐잉 모델이 계산하는 값은 평균 종단 지연시간이지 P99 같은 백분위수가 아니다 — 화면 라벨도
   *  "평균 지연시간"으로 표기할 것. */
  avgLatencyMs: number | null;
  createdAt: string;
}

export interface ArchitectureDashboardSummary extends ArchitectureSummary {
  nodeCount: number;
  validation: ArchitectureValidationSummary;
  latestSimulation: ArchitectureLatestSimulationSummary | null;
}

export interface CreateArchitectureRequest {
  name: string;
  graph: ArchitectureGraph;
}

export interface UpdateArchitectureRequest {
  name?: string;
  graph?: ArchitectureGraph;
}

export interface ShareArchitectureResponse {
  shareToken: string;
  shareUrl: string;
}
