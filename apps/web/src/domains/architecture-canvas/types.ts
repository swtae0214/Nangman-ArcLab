import type { ArchitectureGraph, ComponentType, GraphEdge, GraphNode } from "@nangman/shared-types";
import type { Edge, Node } from "@xyflow/react";
import {
  COMPONENT_META,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  DEFAULT_LEAF_HEIGHT,
  DEFAULT_LEAF_WIDTH,
  LOGICAL_GROUP_TYPES,
} from "./component-meta";
import { sortParentsBeforeChildren } from "./containment";

const LOGICAL_GROUP_TYPE_SET = new Set<ComponentType>(LOGICAL_GROUP_TYPES);

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  presetCode?: string;
  /** 9단계: Target Group(논리적 그룹) 소속. React Flow의 Node 타입에는 커스텀 최상위 필드를
   *  못 넣어서 data 안에 두고, 저장 시에는 GraphNode의 최상위 logicalGroupId로 옮긴다. */
  logicalGroupId?: string;
  /** 10단계: 같은 z-index 등급 안에서 앞/뒤 순서를 사용자가 직접 보정하는 값. computeZIndex에서 사용. */
  zOrderBias?: number;
  /** 11단계: TEXT_BOX 전용 — 글자 크기. 다른 타입은 항상 비워둔다. */
  fontSize?: "sm" | "md" | "lg";
  /** 13단계: 이 노드를 "윗단과 끊어진 별도 입구"로 취급하는 직접 지정 RPS. */
  trafficOverrideRps?: number;
  /** 13단계: USER(입구) 노드 전용 — 평상시 평균 RPS. */
  entryAvgRps?: number;
  /** 13단계: USER(입구) 노드 전용 — 피크 배수. */
  entryPeakMultiplier?: number;
  /** F4: USER(입구) 노드 전용 — CDN/LOAD_BALANCER 비용 계산이 공통으로 쓰는 평균 응답 크기(KB). */
  entryAvgResponseSizeKb?: number;
  /** F4: CDN 전용 — 캐시 적중률(%). */
  cdnCacheHitRatioPercent?: number;
  /** F4: LOAD_BALANCER 전용 — 연결 재사용(keep-alive) 여부. */
  albConnectionReuse?: boolean;
  /** F4: LOAD_BALANCER 전용 — 연결 재사용 시, 연결당 평균 요청 수. */
  albRequestsPerConnection?: number;
  /** F5: LOAD_BALANCER 전용 — LCU 계산이 안 돼도 고정 시간당 요금만 합계에 넣을지. */
  albAcceptPartialCost?: boolean;
  /** F4: 프리셋 선택 가능 타입 전용 — 같은 프리셋을 몇 대 쓰는지(용량 계산 + 비용 둘 다에 쓰임). 기본값 1. */
  instanceCount?: number;
  /** 13단계: APP_RUNNER 전용 — App Runner 자체 오토스케일링의 최소 인스턴스 수(min size). */
  appRunnerMinInstanceCount?: number;
  /** 13단계: SQS/Kinesis Data Streams 전용 — 컨슈머가 초당 처리할 수 있는 메시지(레코드) 수. */
  queueConsumerThroughputRps?: number;
}

export type FlowNode = Node<FlowNodeData, ComponentType>;

export interface FlowEdgeData extends Record<string, unknown> {
  /** 13단계: 보통은 저장 안 하고 매번 추정하는 엣지 종류 — 그 추정이 틀렸을 때만 사용자가 직접 골라 저장한다. */
  trafficKindOverride?: "distribution" | "call" | "replication";
  /** kind가 "distribution"일 때 — 같은 그룹(형제) 안에서의 상대적 가중치. 기본값 1. */
  distributionWeight?: number;
  /** kind가 "call"일 때 — 요청 1건당 이 선을 타는 평균 횟수. 기본값 1. */
  callsPerRequest?: number;
  /** 14단계: IAM↔컴퓨트 노드 연결 전용 — 이 연결에 권한이 부여되어 있는지. 기본값 true. */
  iamPermissionGranted?: boolean;
}

export type FlowEdge = Edge<FlowEdgeData>;

/** 캔버스에서 노드 하나만 선택됐을 때, 우측 패널이 "요소 상세" 보기로 바뀌면서 보여줄 정보. */
export interface SelectedElementConnection {
  edgeId: string;
  nodeId: string;
  label: string;
  /** 연결선에 붙은 라벨(예: "복제")이 있으면 그대로, 없으면 비워둔다. */
  edgeLabel?: string;
  /** 추정(또는 사용자가 직접 고른) 엣지 종류. */
  kind: "distribution" | "call" | "replication";
  /** kind별로 의미 있는 값만 채워진다 — distribution=가중치, call=요청당 횟수, replication=없음(undefined). */
  value?: number;
  /** F6(A2): true면 value가 사용자가 직접 정한 게 아니라 타입 쌍 기본값이다("기본값" 칩 표시용). */
  isDefaultValue?: boolean;
  /** F9(B7): 이 선이 실제로 나르는 RPS(= 상류 RPS × 값) — 입력값만으론 "이게 얼마나 되는지" 안 보여서 추가. */
  resultRps?: number;
  /** F9(B7): kind가 "distribution"일 때만 — 형제 가중치 합 대비 이 선의 비율(%). */
  distributionPercent?: number;
}

export interface SelectedElementInfo {
  id: string;
  type: ComponentType;
  label: string;
  /** 조상 컨테이너들의 이름을 바깥→안쪽 순서로 나열한 것 (예: ["VPC", "Private Subnet", "Multi-AZ"]). */
  breadcrumb: string[];
  /** 이 요소로 들어오는 연결(이 요소가 target인 엣지들). */
  inputs: SelectedElementConnection[];
  /** 이 요소에서 나가는 연결(이 요소가 source인 엣지들). */
  outputs: SelectedElementConnection[];
  /** USER(입구) 노드일 때만 값이 있다 — 평상시 평균 RPS. */
  entryAvgRps?: number;
  /** USER(입구) 노드일 때만 값이 있다 — "피크 때는 평균의 몇 배인가" 배수. */
  entryPeakMultiplier?: number;
  /** F4: USER(입구) 노드일 때만 값이 있다 — CDN/LOAD_BALANCER 비용 계산이 공유하는 평균 응답 크기(KB). */
  entryAvgResponseSizeKb?: number;
  /** F4: 트래픽 전파 엔진이 계산한, 이 노드에 도착하는 RPS(현재 그래프 기준, 토글과 무관하게 항상 계산됨). */
  computedRps?: number;
  /** F4: CDN 노드일 때만 값이 있다 — 캐시 적중률(%). */
  cdnCacheHitRatioPercent?: number;
  /** F4: LOAD_BALANCER 노드일 때만 값이 있다 — 연결 재사용(keep-alive) 여부. */
  albConnectionReuse?: boolean;
  /** F4: LOAD_BALANCER 노드일 때만 값이 있다 — 연결 재사용 시, 연결당 평균 요청 수. */
  albRequestsPerConnection?: number;
  /** F5: LOAD_BALANCER 노드일 때만 값이 있다 — LCU 계산이 안 돼도 고정 요금만 반영하는지. */
  albAcceptPartialCost?: boolean;
  /** F4: 프리셋 선택 가능 타입(WEB_SERVER/DB_PRIMARY/DB_REPLICA/CACHE) 노드일 때만 값이 있다. */
  presetCode?: string;
  /** F4: 위와 같은 타입 전용 — 같은 프리셋을 몇 대 쓰는지. */
  instanceCount?: number;
  /** 13단계: APP_RUNNER 노드일 때만 값이 있다 — 최소 인스턴스 수. */
  appRunnerMinInstanceCount?: number;
  /** 13단계: SQS/Kinesis Data Streams 노드일 때만 값이 있다 — 컨슈머 처리 능력(초당 메시지/레코드 수). */
  queueConsumerThroughputRps?: number;
  /** 14단계: 컴퓨트 노드일 때만 값이 있다 — 이 노드와 직접 연결된 IAM 노드들과 각각의 권한 부여 여부. */
  iamConnections?: { edgeId: string; iamNodeLabel: string; granted: boolean }[];
}

/** 저장된 그래프(shared-types)를 React Flow가 다룰 수 있는 노드/엣지 배열로 변환한다. */
export function graphToFlow(graph: ArchitectureGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = graph.nodes.map((node) => {
    const meta = COMPONENT_META[node.type];
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      data: {
        label: node.data.label,
        presetCode: node.data.presetCode,
        logicalGroupId: node.logicalGroupId,
        zOrderBias: node.zOrderBias,
        fontSize: node.data.fontSize,
        trafficOverrideRps: node.data.trafficOverrideRps,
        entryAvgRps: node.data.entryAvgRps,
        entryPeakMultiplier: node.data.entryPeakMultiplier,
        entryAvgResponseSizeKb: node.data.entryAvgResponseSizeKb,
        cdnCacheHitRatioPercent: node.data.cdnCacheHitRatioPercent,
        albConnectionReuse: node.data.albConnectionReuse,
        albRequestsPerConnection: node.data.albRequestsPerConnection,
        albAcceptPartialCost: node.data.albAcceptPartialCost,
        instanceCount: node.data.instanceCount,
        appRunnerMinInstanceCount: node.data.appRunnerMinInstanceCount,
        queueConsumerThroughputRps: node.data.queueConsumerThroughputRps,
      },
      // 저장된 크기가 있으면(중첩 배치·리사이즈로 부모보다 작게 만든 그룹/리프 등) 그걸 그대로 쓰고,
      // 없을 때만(옛 데이터, 최초 생성 등) 기본 크기로 어림잡는다. 논리적 그룹(Target Group/ASG)은
      // 멤버 위치를 보고 매번 다시 계산되는(derivation effect) 전용 로직이 있어서 여기서 손대지 않는다.
      ...(meta.isGroup
        ? { width: node.width ?? DEFAULT_GROUP_WIDTH, height: node.height ?? DEFAULT_GROUP_HEIGHT }
        : LOGICAL_GROUP_TYPE_SET.has(node.type)
          ? { ...(node.width !== undefined ? { width: node.width } : {}), ...(node.height !== undefined ? { height: node.height } : {}) }
          : {
              width: node.width ?? meta.defaultSize?.width ?? DEFAULT_LEAF_WIDTH,
              height: node.height ?? meta.defaultSize?.height ?? DEFAULT_LEAF_HEIGHT,
            }),
    };
  });
  const edges: FlowEdge[] = graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(edge.label ? { label: edge.label } : {}),
    data: {
      trafficKindOverride: edge.trafficKindOverride,
      distributionWeight: edge.distributionWeight,
      callsPerRequest: edge.callsPerRequest,
      iamPermissionGranted: edge.iamPermissionGranted,
    },
  }));
  // 12단계: React Flow는 부모 노드가 배열에서 자식보다 앞에 있어야 절대좌표를 올바르게 계산한다.
  // 예전에 이 순서가 깨진 채로 저장된 그래프(또는 그 사이에 생긴 버그로 깨진 그래프)를 불러와도
  // 화면이 멀쩡하게 보이도록, 불러올 때마다 순서를 다시 보장한다.
  return { nodes: sortParentsBeforeChildren(nodes), edges };
}

/**
 * 캔버스 상태(React Flow)를 저장용 그래프(shared-types)로 되돌린다.
 * React Flow 전용 필드(selected 등)는 걷어내지만, width/height는 그룹을 중첩하거나 리사이즈한
 * 결과를 다음에 불러왔을 때도 유지해야 해서 값이 있으면 그대로 저장한다.
 */
export function flowToGraph(nodes: FlowNode[], edges: FlowEdge[]): ArchitectureGraph {
  const graphNodes: GraphNode[] = nodes.map((node) => ({
    id: node.id,
    type: node.type ?? "WEB_SERVER",
    position: node.position,
    ...(node.parentId ? { parentId: node.parentId } : {}),
    ...(node.width !== undefined ? { width: node.width } : {}),
    ...(node.height !== undefined ? { height: node.height } : {}),
    ...(node.data.logicalGroupId ? { logicalGroupId: node.data.logicalGroupId } : {}),
    ...(node.data.zOrderBias ? { zOrderBias: node.data.zOrderBias } : {}),
    data: {
      label: node.data.label,
      ...(node.data.presetCode ? { presetCode: node.data.presetCode } : {}),
      ...(node.data.fontSize ? { fontSize: node.data.fontSize } : {}),
      ...(node.data.trafficOverrideRps != null ? { trafficOverrideRps: node.data.trafficOverrideRps } : {}),
      ...(node.data.entryAvgRps != null ? { entryAvgRps: node.data.entryAvgRps } : {}),
      ...(node.data.entryPeakMultiplier != null ? { entryPeakMultiplier: node.data.entryPeakMultiplier } : {}),
      ...(node.data.entryAvgResponseSizeKb != null ? { entryAvgResponseSizeKb: node.data.entryAvgResponseSizeKb } : {}),
      ...(node.data.cdnCacheHitRatioPercent != null ? { cdnCacheHitRatioPercent: node.data.cdnCacheHitRatioPercent } : {}),
      ...(node.data.albConnectionReuse != null ? { albConnectionReuse: node.data.albConnectionReuse } : {}),
      ...(node.data.albRequestsPerConnection != null ? { albRequestsPerConnection: node.data.albRequestsPerConnection } : {}),
      ...(node.data.albAcceptPartialCost != null ? { albAcceptPartialCost: node.data.albAcceptPartialCost } : {}),
      ...(node.data.instanceCount != null ? { instanceCount: node.data.instanceCount } : {}),
      ...(node.data.appRunnerMinInstanceCount != null ? { appRunnerMinInstanceCount: node.data.appRunnerMinInstanceCount } : {}),
      ...(node.data.queueConsumerThroughputRps != null ? { queueConsumerThroughputRps: node.data.queueConsumerThroughputRps } : {}),
    },
  }));
  const graphEdges: GraphEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(typeof edge.label === "string" && edge.label ? { label: edge.label } : {}),
    ...(edge.data?.trafficKindOverride ? { trafficKindOverride: edge.data.trafficKindOverride } : {}),
    ...(edge.data?.distributionWeight != null ? { distributionWeight: edge.data.distributionWeight } : {}),
    ...(edge.data?.callsPerRequest != null ? { callsPerRequest: edge.data.callsPerRequest } : {}),
    ...(edge.data?.iamPermissionGranted != null ? { iamPermissionGranted: edge.data.iamPermissionGranted } : {}),
  }));
  return { nodes: graphNodes, edges: graphEdges };
}
