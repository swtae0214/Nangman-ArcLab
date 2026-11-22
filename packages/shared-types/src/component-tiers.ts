import type { ComponentType } from "./architecture.js";

/**
 * 12단계: SPOF/시뮬레이션(M/M/c) 엔진이 지금까지 LOAD_BALANCER/WEB_SERVER/DB_PRIMARY/DB_REPLICA
 * 4개 타입만 하드코딩해서 다루던 걸, "역할"별로 묶어서 같은 역할의 다른 AWS 서비스도 같이
 * 계산되게 한다. 어떤 타입을 어느 묶음에 넣을지는 AWS 서비스 자체의 실제 동작 방식을 확인하고
 * 정했다 — 예를 들어 Aurora/DynamoDB는 스토리지가 항상 자동으로 여러 AZ에 복제되는 서비스라
 * MULTI_AZ_TOGGLE_DATA_TYPES에서 빠진다(RDS처럼 "켜고 끌 수 있는" 설정이 원래 없다).
 */

/** 그래프의 "진입점" 역할 — SPOF-001(LB→DB 경로 단절 검사)과 시뮬레이션 파이프라인의 시작점. */
export const ENTRY_COMPONENT_TYPES: ComponentType[] = ["LOAD_BALANCER", "API_GATEWAY"];

/**
 * 요청을 처리하는 "컴퓨트" 역할 — 시뮬레이션(M/M/c 큐잉)의 웹 서버 계층과 같은 자리에 들어간다.
 * 프리셋(처리 능력 데이터)이 아직 없는 타입은 기존 폴백(기본값 100 RPS + 경고)으로 계산된다.
 */
export const COMPUTE_COMPONENT_TYPES: ComponentType[] = [
  "WEB_SERVER",
  "LAMBDA",
  "FARGATE",
  "ECS",
  "APP_RUNNER",
  "ELASTIC_BEANSTALK",
];

/**
 * "데이터 저장소" 역할 — SPOF-001의 도착점, 시뮬레이션의 DB 계층과 같은 자리에 들어간다.
 * S3는 일부러 뺐다: 정적 자산 저장용으로 주로 옆가지에 붙지, LB→...→DB처럼 요청이 직렬로
 * 지나가는 경로 한가운데 있는 경우가 흔치 않아서, 넣으면 엉뚱한 SPOF/병목 오탐이 날 수 있다.
 */
export const DATA_COMPONENT_TYPES: ComponentType[] = [
  "DB_PRIMARY",
  "DB_REPLICA",
  "AURORA",
  "DOCUMENT_DB",
  "REDSHIFT",
  "OPENSEARCH",
  "DYNAMODB",
];

/**
 * ASG-001(최소 2대 이상 이중화)을 적용할 수 있는 타입 — "실제로 AWS EC2 Auto Scaling Group을
 * 쓰는 서비스"만 넣었다. Fargate(ASG 자체가 없음, ECS 서비스의 태스크 수로 스케일링)와
 * App Runner(자체 동시성 기반 스케일링)는 진짜 ASG가 아니라서 뺐다 — 이 둘의 이중화 체크는
 * 각자의 메커니즘에 맞는 별도 규칙이 필요하다(TODO, 범위 밖).
 */
export const ASG_CAPABLE_COMPUTE_TYPES: ComponentType[] = ["WEB_SERVER", "ECS", "ELASTIC_BEANSTALK"];

/**
 * MULTIAZ-001(Multi-AZ 그룹 배치 확인)을 적용할 수 있는 타입 — "사용자가 Multi-AZ를 켜고 끌 수
 * 있는" 서비스만 넣었다. Aurora/DocumentDB(스토리지가 항상 자동으로 3개 AZ에 복제)와
 * DynamoDB(리전 내 AZ 복제가 항상 자동, Global Tables는 리전 간 복제라 별개 개념)는 애초에
 * "그룹에 넣었는지" 물어볼 설정 자체가 없어서 뺐다 — 영구적인 제외다.
 */
export const MULTI_AZ_TOGGLE_DATA_TYPES: ComponentType[] = ["DB_PRIMARY", "DB_REPLICA", "REDSHIFT", "OPENSEARCH"];
