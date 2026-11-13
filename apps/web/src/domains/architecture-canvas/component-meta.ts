import type { ComponentType } from "@nangman/shared-types";
import {
  ArchitectureGroupAutoScalinggroup,
  ArchitectureGroupAWSCloud,
  ArchitectureGroupCorporatedatacenter,
  ArchitectureGroupPrivatesubnet,
  ArchitectureGroupPublicsubnet,
  ArchitectureGroupRegion,
  ArchitectureGroupVirtualprivatecloudVPC,
  ArchitectureServiceAmazonAPIGateway,
  ArchitectureServiceAmazonAurora,
  ArchitectureServiceAmazonCloudFront,
  ArchitectureServiceAmazonCloudWatch,
  ArchitectureServiceAmazonCognito,
  ArchitectureServiceAmazonDataFirehose,
  ArchitectureServiceAmazonDocumentDB,
  ArchitectureServiceAmazonEC2,
  ArchitectureServiceAmazonElastiCache,
  ArchitectureServiceAmazonElasticContainerRegistry,
  ArchitectureServiceAmazonKinesisDataStreams,
  ArchitectureServiceAmazonRDS,
  ArchitectureServiceAmazonRoute53,
  ArchitectureServiceAmazonSimpleNotificationService,
  ArchitectureServiceAmazonSimpleQueueService,
  ArchitectureServiceAmazonSimpleStorageService,
  ArchitectureServiceAWSCloudFormation,
  ArchitectureServiceAWSCodeBuild,
  ArchitectureServiceAWSCodePipeline,
  ArchitectureServiceAWSDirectConnect,
  ArchitectureServiceAWSFargate,
  ArchitectureServiceAWSIoTCore,
  ArchitectureServiceAWSLambda,
  ArchitectureServiceAWSSecretsManager,
  ArchitectureServiceAWSShield,
  ArchitectureServiceAWSSitetoSiteVPN,
  ArchitectureServiceAWSTransitGateway,
  ArchitectureServiceAWSWAF,
  ArchitectureServiceElasticLoadBalancing,
  ResourceAmazonVPCInternetGateway,
  ResourceAmazonVPCNATGateway,
  ResourceAWSSystemsManagerParameterStore,
  ResourceUser,
} from "aws-react-icons";
import type { FC } from "react";
import { GenericGroupIcon } from "./icons/GenericGroupIcon";

export type ComponentCategory =
  | "핵심 인프라"
  | "네트워킹"
  | "엣지/보안"
  | "컴퓨트/메시징"
  | "네트워크 경계"
  | "데이터/스트리밍"
  | "CI/CD";

export interface ComponentMeta {
  type: ComponentType;
  label: string;
  Icon: FC<{ size?: number | string }>;
  isGroup: boolean;
  category: ComponentCategory;
  /** true면 2/3단계 정적 검증·시뮬레이션 엔진의 계산 대상. false는 아직 시각 요소로만 존재. */
  isSimulated: boolean;
  /** true면 팔레트에서 직접 드래그해 새로 만들 수 없다 (예: GENERIC_GROUP은 선택 후 "묶기"로만 생성). */
  hideFromPalette?: boolean;
}

/**
 * 전체 컴포넌트 타입 ↔ 실제 AWS 공식 Architecture Icons 매핑.
 * 아이콘 자체에 AWS 공식 색이 들어있어서(EC2=주황, Region=청록 등) 노드 배경은 굳이 타입별로 색칠하지 않는다.
 *
 * "핵심 인프라" 9종만 검증/시뮬레이션 엔진 계산에 들어간다. 나머지(네트워킹/엣지·보안/컴퓨트·메시징)는
 * 사용자 요청으로 추가한 시각적 컴포넌트로, 캔버스에 그려지고 저장은 되지만 SPOF 탐지나 M/M/c 큐잉
 * 계산에는 아직 포함되지 않는다 — 필요해지면 이 표의 isSimulated만 바꾸고 엔진 쪽 규칙을 추가하면 된다.
 *
 * Multi-AZ 전용 아이콘은 이 패키지(공식 아이콘 기반)에 없어서, 가장 가까운 개념인
 * VPC(네트워크 경계 상자) 아이콘으로 대체했다.
 */
export const COMPONENT_META: Record<ComponentType, ComponentMeta> = {
  // 11단계: 트래픽이 어디서 시작되는지 표시하는 용도 — SPOF/큐잉 계산 대상은 아니라서 isSimulated: false.
  USER: {
    type: "USER",
    label: "사용자 (User)",
    Icon: ResourceUser,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: false,
  },
  LOAD_BALANCER: {
    type: "LOAD_BALANCER",
    label: "로드밸런서",
    Icon: ArchitectureServiceElasticLoadBalancing,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  WEB_SERVER: {
    type: "WEB_SERVER",
    label: "웹 서버 (EC2)",
    Icon: ArchitectureServiceAmazonEC2,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  DB_PRIMARY: {
    type: "DB_PRIMARY",
    label: "DB Primary (RDS)",
    Icon: ArchitectureServiceAmazonRDS,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  DB_REPLICA: {
    type: "DB_REPLICA",
    label: "DB Replica (RDS)",
    Icon: ArchitectureServiceAmazonRDS,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  CACHE: {
    type: "CACHE",
    label: "캐시 (ElastiCache)",
    Icon: ArchitectureServiceAmazonElastiCache,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  CDN: {
    type: "CDN",
    label: "CDN (CloudFront)",
    Icon: ArchitectureServiceAmazonCloudFront,
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  AUTO_SCALING_GROUP: {
    type: "AUTO_SCALING_GROUP",
    label: "Auto Scaling Group",
    Icon: ArchitectureGroupAutoScalinggroup,
    // 9단계: 실제 AWS의 ASG는 한 서브넷/AZ에 갇히지 않고 여러 곳에 걸쳐 있는 게 정상이라,
    // VPC/Subnet 같은 물리적 그룹(parentId 소속)이 아니라 Target Group과 같은 논리적 그룹으로 바꿨다.
    // isGroup을 false로 둬야 팔레트 드롭 시 다른 컴포넌트가 실수로 "물리적으로" 안에 안 들어간다.
    // 팔레트에는 그대로 남겨둔다 — 예전처럼 캔버스에 먼저 놓고 그 위로 웹 서버를 드롭해서 채우는
    // 방식도 여전히 되고(ArchitectureCanvas의 findLogicalGroupAt 참고), 여러 서브넷에 걸치고
    // 싶을 땐 기존 노드를 선택해 "ASG로 묶기" 버튼을 쓰면 된다.
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: true,
  },
  MULTI_AZ_GROUP: {
    type: "MULTI_AZ_GROUP",
    label: "Multi-AZ 그룹",
    Icon: ArchitectureGroupVirtualprivatecloudVPC,
    isGroup: true,
    category: "핵심 인프라",
    isSimulated: true,
  },
  MULTI_REGION_GROUP: {
    type: "MULTI_REGION_GROUP",
    label: "Multi-Region 그룹",
    Icon: ArchitectureGroupRegion,
    isGroup: true,
    category: "핵심 인프라",
    isSimulated: true,
  },
  GENERIC_GROUP: {
    type: "GENERIC_GROUP",
    label: "그룹",
    Icon: GenericGroupIcon,
    isGroup: true,
    category: "핵심 인프라",
    isSimulated: false,
    hideFromPalette: true,
  },
  VPN_GATEWAY: {
    type: "VPN_GATEWAY",
    label: "Site-to-Site VPN",
    Icon: ArchitectureServiceAWSSitetoSiteVPN,
    isGroup: false,
    category: "네트워킹",
    isSimulated: false,
  },
  DIRECT_CONNECT: {
    type: "DIRECT_CONNECT",
    label: "Direct Connect",
    Icon: ArchitectureServiceAWSDirectConnect,
    isGroup: false,
    category: "네트워킹",
    isSimulated: false,
  },
  TRANSIT_GATEWAY: {
    type: "TRANSIT_GATEWAY",
    label: "Transit Gateway",
    Icon: ArchitectureServiceAWSTransitGateway,
    isGroup: false,
    category: "네트워킹",
    isSimulated: false,
  },
  NAT_GATEWAY: {
    type: "NAT_GATEWAY",
    label: "NAT Gateway",
    Icon: ResourceAmazonVPCNATGateway,
    isGroup: false,
    category: "네트워킹",
    isSimulated: false,
  },
  INTERNET_GATEWAY: {
    type: "INTERNET_GATEWAY",
    label: "Internet Gateway",
    Icon: ResourceAmazonVPCInternetGateway,
    isGroup: false,
    category: "네트워킹",
    isSimulated: false,
  },
  WAF: {
    type: "WAF",
    label: "WAF",
    Icon: ArchitectureServiceAWSWAF,
    isGroup: false,
    category: "엣지/보안",
    isSimulated: false,
  },
  SHIELD: {
    type: "SHIELD",
    label: "Shield",
    Icon: ArchitectureServiceAWSShield,
    isGroup: false,
    category: "엣지/보안",
    isSimulated: false,
  },
  API_GATEWAY: {
    type: "API_GATEWAY",
    label: "API Gateway",
    Icon: ArchitectureServiceAmazonAPIGateway,
    isGroup: false,
    category: "엣지/보안",
    isSimulated: false,
  },
  ROUTE53: {
    type: "ROUTE53",
    label: "Route 53",
    Icon: ArchitectureServiceAmazonRoute53,
    isGroup: false,
    category: "엣지/보안",
    isSimulated: false,
  },
  LAMBDA: {
    type: "LAMBDA",
    label: "Lambda",
    Icon: ArchitectureServiceAWSLambda,
    isGroup: false,
    category: "컴퓨트/메시징",
    isSimulated: false,
  },
  SQS: {
    type: "SQS",
    label: "SQS",
    Icon: ArchitectureServiceAmazonSimpleQueueService,
    isGroup: false,
    category: "컴퓨트/메시징",
    isSimulated: false,
  },
  SNS: {
    type: "SNS",
    label: "SNS",
    Icon: ArchitectureServiceAmazonSimpleNotificationService,
    isGroup: false,
    category: "컴퓨트/메시징",
    isSimulated: false,
  },
  S3: {
    type: "S3",
    label: "S3",
    Icon: ArchitectureServiceAmazonSimpleStorageService,
    isGroup: false,
    category: "컴퓨트/메시징",
    isSimulated: false,
  },
  // 9단계: Region > AZ > VPC > Subnet처럼 겹쳐서 그리는 경계 상자.
  REGION: {
    type: "REGION",
    label: "Region",
    Icon: ArchitectureGroupRegion,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  AWS_CLOUD: {
    type: "AWS_CLOUD",
    label: "AWS Cloud",
    Icon: ArchitectureGroupAWSCloud,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  VPC: {
    type: "VPC",
    label: "VPC",
    Icon: ArchitectureGroupVirtualprivatecloudVPC,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  PUBLIC_SUBNET: {
    type: "PUBLIC_SUBNET",
    label: "Public Subnet",
    Icon: ArchitectureGroupPublicsubnet,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  PRIVATE_SUBNET: {
    type: "PRIVATE_SUBNET",
    label: "Private Subnet",
    Icon: ArchitectureGroupPrivatesubnet,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  AVAILABILITY_ZONE: {
    type: "AVAILABILITY_ZONE",
    label: "Availability Zone",
    // AWS 공식 아이콘 세트에 AZ 전용 경계 상자 아이콘이 없어서(Region/VPC/Subnet과 달리),
    // GENERIC_GROUP과 동일한 범용 아이콘으로 대체했다.
    Icon: GenericGroupIcon,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  CORPORATE_DATACENTER: {
    type: "CORPORATE_DATACENTER",
    label: "Corporate Data Center",
    Icon: ArchitectureGroupCorporatedatacenter,
    isGroup: true,
    category: "네트워크 경계",
    isSimulated: false,
  },
  // 9단계: IoT/스트리밍 참고 아키텍처에 나온 서비스.
  IOT_CORE: {
    type: "IOT_CORE",
    label: "AWS IoT Core",
    Icon: ArchitectureServiceAWSIoTCore,
    isGroup: false,
    category: "데이터/스트리밍",
    isSimulated: false,
  },
  KINESIS_DATA_STREAMS: {
    type: "KINESIS_DATA_STREAMS",
    label: "Kinesis Data Streams",
    Icon: ArchitectureServiceAmazonKinesisDataStreams,
    isGroup: false,
    category: "데이터/스트리밍",
    isSimulated: false,
  },
  KINESIS_DATA_FIREHOSE: {
    type: "KINESIS_DATA_FIREHOSE",
    label: "Kinesis Data Firehose",
    Icon: ArchitectureServiceAmazonDataFirehose,
    isGroup: false,
    category: "데이터/스트리밍",
    isSimulated: false,
  },
  AURORA: {
    type: "AURORA",
    label: "Aurora",
    Icon: ArchitectureServiceAmazonAurora,
    isGroup: false,
    category: "데이터/스트리밍",
    isSimulated: false,
  },
  COGNITO: {
    type: "COGNITO",
    label: "Cognito",
    Icon: ArchitectureServiceAmazonCognito,
    isGroup: false,
    category: "데이터/스트리밍",
    isSimulated: false,
  },
  DOCUMENT_DB: {
    type: "DOCUMENT_DB",
    // 참고 이미지의 "MongoDB"는 AWS 공식 아이콘이 아니라서(서드파티 제품), 가장 가까운 AWS 매니지드
    // 서비스인 DocumentDB(MongoDB 호환)로 대체했다.
    label: "DocumentDB (MongoDB 호환)",
    Icon: ArchitectureServiceAmazonDocumentDB,
    isGroup: false,
    category: "데이터/스트리밍",
    isSimulated: false,
  },
  // 9단계: CI/CD 파이프라인 참고 아키텍처에 나온 서비스.
  CODEPIPELINE: {
    type: "CODEPIPELINE",
    label: "CodePipeline",
    Icon: ArchitectureServiceAWSCodePipeline,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  CODEBUILD: {
    type: "CODEBUILD",
    label: "CodeBuild",
    Icon: ArchitectureServiceAWSCodeBuild,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  CLOUDFORMATION: {
    type: "CLOUDFORMATION",
    label: "CloudFormation",
    Icon: ArchitectureServiceAWSCloudFormation,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  CLOUDWATCH: {
    type: "CLOUDWATCH",
    label: "CloudWatch",
    Icon: ArchitectureServiceAmazonCloudWatch,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  PARAMETER_STORE: {
    type: "PARAMETER_STORE",
    label: "Parameter Store",
    Icon: ResourceAWSSystemsManagerParameterStore,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  // 10단계: reel-gen류 서버리스/컨테이너 파이프라인 참고 아키텍처에 나온 서비스.
  FARGATE: {
    type: "FARGATE",
    label: "ECS Fargate Container",
    Icon: ArchitectureServiceAWSFargate,
    // Auto Scaling Group과 달리 Fargate 컨테이너는 실제로 한 곳에서 실행되는 물리적 컨테이너라,
    // VPC/Subnet과 똑같이 진짜 부모-자식(parentId) 관계로 다룬다 — 논리적 그룹으로 만들 이유가 없다.
    isGroup: true,
    category: "핵심 인프라",
    isSimulated: false,
  },
  ECR: {
    type: "ECR",
    label: "ECR",
    Icon: ArchitectureServiceAmazonElasticContainerRegistry,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  SECRETS_MANAGER: {
    type: "SECRETS_MANAGER",
    label: "Secrets Manager",
    Icon: ArchitectureServiceAWSSecretsManager,
    isGroup: false,
    category: "CI/CD",
    isSimulated: false,
  },
  TARGET_GROUP: {
    type: "TARGET_GROUP",
    label: "Target Group",
    // AWS 공식 아이콘 세트에 Target Group 전용 아이콘이 없어서(Availability Zone과 동일한 사정)
    // 범용 아이콘으로 대체하고, 대신 테두리 색(빨강)으로 "이건 물리적 그룹과 다르다"를 구분한다.
    Icon: GenericGroupIcon,
    // 물리적 컨테이너(parentId 소속 변경)가 아니라 논리적 그룹이라 isGroup은 false로 둔다 —
    // 그래야 팔레트 드롭 시 다른 컴포넌트가 실수로 이 안에 "물리적으로" 들어가지 않는다.
    isGroup: false,
    category: "핵심 인프라",
    isSimulated: false,
    hideFromPalette: true,
  },
};

const COMPONENT_CATEGORY_ORDER: ComponentCategory[] = [
  "핵심 인프라",
  "네트워크 경계",
  "네트워킹",
  "엣지/보안",
  "데이터/스트리밍",
  "컴퓨트/메시징",
  "CI/CD",
];

/** 팔레트가 카테고리별 섹션으로 렌더링할 때 쓰는 순서. COMPONENT_META의 키 순서를 그대로 원천으로 삼는다. */
export const COMPONENT_PALETTE_SECTIONS: { category: ComponentCategory; types: ComponentType[] }[] =
  COMPONENT_CATEGORY_ORDER.map((category) => ({
    category,
    types: (Object.values(COMPONENT_META) as ComponentMeta[])
      .filter((meta) => meta.category === category && !meta.hideFromPalette)
      .map((meta) => meta.type),
  }));

export const DEFAULT_GROUP_WIDTH = 360;
export const DEFAULT_GROUP_HEIGHT = 220;

/** 리프 노드는 크기를 지정하지 않아 실측(measured) 전엔 이 값으로 어림잡는다 (묶기 시 바운딩 박스 계산용). */
export const DEFAULT_LEAF_WIDTH = 110;
export const DEFAULT_LEAF_HEIGHT = 90;

/** "그룹으로 묶기" 시, 선택된 노드들의 바운딩 박스 바깥으로 얼마나 여백을 둘지. */
export const GROUP_PADDING = 48;
/** GroupNode 헤더(아이콘+이름표) 높이만큼은 위쪽에 더 띄워서 자식 노드가 헤더와 겹치지 않게 한다. */
export const GROUP_HEADER_HEIGHT = 32;

/** 9단계: 그룹을 그룹 안에 중첩할 때/사용자가 손으로 리사이즈할 때 허용하는 최소 크기. */
export const NESTED_GROUP_MIN_WIDTH = 160;
export const NESTED_GROUP_MIN_HEIGHT = 100;

/**
 * 9단계: 중첩된 그룹들이 전부 같은 회색 점선 테두리라 어디서부터 어디까지가 한 박스인지 눈으로
 * 구분이 안 된다는 피드백을 받고, 중첩 깊이(0=최상위, 1=그 안, 2=그 안의 안, …)에 따라 테두리 색을
 * 순환시키기로 했다. 5개를 넘어가는 깊이는 다시 처음 색부터 반복한다.
 */
export const NESTING_BORDER_COLORS = [
  "border-gray-400",
  "border-blue-400",
  "border-emerald-500",
  "border-amber-500",
  "border-pink-500",
] as const;

/**
 * 9단계: 물리적 컨테이너(GroupNode)의 반투명 배경이 다른 노드를 가려버리는 문제 — 특히 논리적
 * 그룹(ASG/Target Group) 이름표가 Subnet 배경에 덮여 흐릿해 보이던 문제를 겪고 나서, 노드 종류별로
 * z-index 등급을 나눈다. 물리 컨테이너는 중첩이 깊을수록(자식일수록) 위에 그려져야 부모의 반투명
 * 배경에 덮이지 않고, 논리 그룹은 어떤 물리 컨테이너보다도 항상 위, 실제 컴포넌트(리프 노드)는
 * 항상 맨 위에 있어야 가려지지 않는다. 실제 계산은 ArchitectureCanvas.tsx에서 한다.
 */
export const Z_INDEX_GROUP_BASE = 10;
export const Z_INDEX_GROUP_DEPTH_STEP = 10;
export const Z_INDEX_LOGICAL_GROUP = 500;
export const Z_INDEX_LEAF = 900;

/**
 * 10단계: "앞으로 가져오기/뒤로 보내기" 보정값의 허용 범위. 같은 등급(같은 깊이의 물리 컨테이너끼리,
 * 혹은 리프 노드끼리) 안에서만 순서를 바꿔야 하므로, 가장 좁은 간격인 Z_INDEX_GROUP_DEPTH_STEP(10)보다
 * 작게 clamp해서 보정값이 다음 깊이 등급을 침범하지 않게 한다.
 */
export const Z_ORDER_BIAS_MIN = -5;
export const Z_ORDER_BIAS_MAX = 5;

/**
 * 9단계: "논리적 그룹" — 물리적 컨테이너(VPC/Subnet 등, parentId 소속)와 달리, 멤버가 서로 다른
 * 컨테이너에 있어도 data.logicalGroupId만 공유해서 경계를 가로질러 하나로 묶여 보인다.
 * Target Group은 참고 이미지의 빨간 테두리를 그대로 따랐고, Auto Scaling Group은 실제 AWS
 * 아이콘 색(주황)에 맞춰 구분했다.
 */
export const LOGICAL_GROUP_TYPES: readonly ComponentType[] = ["TARGET_GROUP", "AUTO_SCALING_GROUP"];
export const LOGICAL_GROUP_PADDING = 24;
export const LOGICAL_GROUP_BORDER_COLOR: Partial<Record<ComponentType, string>> = {
  TARGET_GROUP: "border-red-500",
  AUTO_SCALING_GROUP: "border-orange-500",
};
export const DEFAULT_LOGICAL_GROUP_BORDER_COLOR = "border-red-500";
