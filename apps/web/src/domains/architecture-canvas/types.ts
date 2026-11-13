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
}

export type FlowNode = Node<FlowNodeData, ComponentType>;
export type FlowEdge = Edge;

/** 저장된 그래프(shared-types)를 React Flow가 다룰 수 있는 노드/엣지 배열로 변환한다. */
export function graphToFlow(graph: ArchitectureGraph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const nodes: FlowNode[] = graph.nodes.map((node) => {
    const meta = COMPONENT_META[node.type];
    return {
      id: node.id,
      type: node.type,
      position: node.position,
      ...(node.parentId ? { parentId: node.parentId, extent: "parent" as const } : {}),
      data: {
        label: node.data.label,
        presetCode: node.data.presetCode,
        logicalGroupId: node.logicalGroupId,
        zOrderBias: node.zOrderBias,
        fontSize: node.data.fontSize,
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
  }));
  return { nodes, edges };
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
    },
  }));
  const graphEdges: GraphEdge[] = edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    ...(typeof edge.label === "string" && edge.label ? { label: edge.label } : {}),
  }));
  return { nodes: graphNodes, edges: graphEdges };
}
