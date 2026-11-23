"use client";

import "@xyflow/react/dist/style.css";
import { COMPUTE_COMPONENT_TYPES, type ArchitectureGraph, type ComponentType } from "@nangman/shared-types";
import {
  addEdge,
  Background,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useStore,
  type ColorMode,
  type OnConnect,
} from "@xyflow/react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import {
  COMPONENT_META,
  DEFAULT_GROUP_HEIGHT,
  DEFAULT_GROUP_WIDTH,
  DEFAULT_LEAF_HEIGHT,
  DEFAULT_LEAF_WIDTH,
  GROUP_HEADER_HEIGHT,
  GROUP_PADDING,
  LOGICAL_GROUP_PADDING,
  LOGICAL_GROUP_TYPES,
  NESTED_GROUP_MIN_HEIGHT,
  NESTED_GROUP_MIN_WIDTH,
  Z_INDEX_GROUP_BASE,
  Z_INDEX_GROUP_DEPTH_STEP,
  Z_INDEX_LEAF,
  Z_INDEX_LOGICAL_GROUP,
  Z_ORDER_BIAS_MAX,
  Z_ORDER_BIAS_MIN,
} from "../component-meta";
import { generateId } from "@/lib/generate-id";
import {
  detachDescendants,
  findGroupAt,
  findLogicalGroupAt,
  getAbsolutePosition,
  getNodeSize,
  resolveContainment,
  snapshotSubtreeParents,
} from "../containment";
import { useComponentPresets } from "../hooks/useCapacityCalculator";
import { PRESET_SELECTABLE_TYPES, summarizeArchitectureCost, type ArchitectureCostSummary } from "../node-cost";
import { NodeCostLineProvider, NodeCostProvider } from "../node-cost-context";
import { ProblemNodesProvider } from "../problem-nodes-context";
import { ReadOnlyProvider } from "../read-only-context";
import { computeNodeRps, getDefaultCallsPerRequest, inferEdgeKind } from "../traffic-rps";
import { TrafficRpsProvider } from "../traffic-rps-context";
import { flowToGraph, graphToFlow, type FlowEdge, type FlowNode, type SelectedElementInfo } from "../types";
import { CanvasToolbar, type CanvasInteractionMode } from "./CanvasToolbar";
import { COMPONENT_DRAG_DATA_FORMAT } from "./ComponentPalette";
import { LabeledEdge } from "./edges/LabeledEdge";
import { LeftSidebar } from "./LeftSidebar";
import { nodeTypes } from "./node-types";
import { SelectionToolbar } from "./SelectionToolbar";
import { DisplayMenu } from "./DisplayMenu";

const edgeTypes = { labeledStep: LabeledEdge };

interface ArchitectureCanvasProps {
  initialGraph: ArchitectureGraph;
  onGraphChange: (graph: ArchitectureGraph) => void;
  /** 정적 검증 리포트에서 실패로 지목된 노드 id들. 있으면 해당 노드를 캔버스에서 빨간 테두리로 표시한다. */
  problemNodeIds?: ReadonlySet<string>;
  /** 7단계 내보내기(PNG/PDF) 캡처 대상 — 팔레트는 빼고 실제 다이어그램 영역만 잡기 위한 ref. */
  exportContainerRef?: RefObject<HTMLDivElement | null>;
  /** true면 공유 링크로 보는 화면(7단계) — 팔레트를 숨기고 편집/드래그를 막는다. */
  readOnly?: boolean;
  /** React Flow 자체 UI(배경/컨트롤/미니맵) 테마. 토글이 없는 화면(공유 링크 등)은 항상 light로 둔다. */
  colorMode?: ColorMode;
  /** 12단계: "트래픽 흐름 보기"가 켜져 있을 때 강조할 엣지 id들(USER→...→DB 구간). */
  highlightedEdgeIds?: ReadonlySet<string>;
  /** 14단계: IAM 권한이 없어서 실제로는 못 지나가는 엣지 id들 — 빨간 점선+✕로 표시한다. */
  blockedEdgeIds?: ReadonlySet<string>;
  /** "트래픽 흐름 보기" 토글 스위치를 캔버스 좌상단에 띄울 때 쓴다 — 상태 자체는 부모(ArchitectureEditor)가 들고 있는다. */
  showTrafficFlow?: boolean;
  onToggleTrafficFlow?: () => void;
  /** "트래픽(RPS) 표시" 토글 — USER 노드의 평균 RPS가 전파된 값을 각 노드 아래에 띄운다. */
  showTrafficRps?: boolean;
  onToggleTrafficRps?: () => void;
  /** "비용 보기" 토글 — 프리셋에 가격 데이터가 있는 노드 아래에 월 예상 비용을 띄운다. */
  showNodeCost?: boolean;
  onToggleNodeCost?: () => void;
  /** F1: 과금 대상 노드들의 월 비용 집계 — 헤더 배지·"예상 비용" 탭이 쓸 수 있도록 매번 올려보낸다. */
  onCostSummaryChange?: (summary: ArchitectureCostSummary) => void;
  /** 노드 하나만 선택돼 있을 때(엣지 선택 없이) 우측 패널이 "요소 상세" 보기로 바뀔 수 있도록 올려보낸다. 그 외엔 null. */
  onSelectedElementChange?: (info: SelectedElementInfo | null) => void;
}

/** 부모(ArchitectureEditor)가 "캔버스에서 보기" 같은 동작으로 특정 노드를 선택·포커스하게 해주는 핸들. */
export interface ArchitectureCanvasHandle {
  selectNodes: (nodeIds: string[]) => void;
  /** USER(입구) 노드의 평균 RPS/피크 배수/평균 응답 크기를 우측 패널에서 바로 고칠 수 있게 해주는 통로. */
  updateEntryTraffic: (nodeId: string, patch: { entryAvgRps?: number; entryPeakMultiplier?: number; entryAvgResponseSizeKb?: number }) => void;
  /** F4: CDN 캐시 적중률/LOAD_BALANCER 연결 재사용 설정을 우측 패널에서 바로 고칠 수 있게 해주는 통로. */
  updateUsageBasedCostSettings: (
    nodeId: string,
    patch: {
      cdnCacheHitRatioPercent?: number;
      albConnectionReuse?: boolean;
      albRequestsPerConnection?: number;
      albAcceptPartialCost?: boolean;
    },
  ) => void;
  /** F4: 프리셋 선택 가능 타입의 인스턴스 수를 우측 패널(용량 섹션)에서 바로 고칠 수 있게 해주는 통로. */
  updateCapacitySettings: (nodeId: string, patch: { instanceCount?: number }) => void;
  /** 13단계: APP_RUNNER의 최소 인스턴스 수를 우측 패널에서 바로 고칠 수 있게 해주는 통로. */
  updateRedundancySettings: (nodeId: string, patch: { appRunnerMinInstanceCount?: number }) => void;
  /** 13단계: SQS/Kinesis Data Streams의 컨슈머 처리 능력을 우측 패널에서 바로 고칠 수 있게 해주는 통로. */
  updateQueueSettings: (nodeId: string, patch: { queueConsumerThroughputRps?: number }) => void;
  /** 연결(엣지)의 분배 가중치·호출 횟수를 우측 패널의 "연결" 섹션에서 바로 고칠 수 있게 해주는 통로.
   *  edgeIds를 여러 개 주면(묶여서 보이던 연결들) 한 번에 같은 값으로 맞춘다. */
  updateEdgeTraffic: (
    edgeIds: string[],
    patch: { distributionWeight?: number; callsPerRequest?: number; iamPermissionGranted?: boolean },
  ) => void;
}

const EMPTY_PROBLEM_NODE_IDS: ReadonlySet<string> = new Set();
const EMPTY_RPS_BY_NODE_ID: ReadonlyMap<string, number> = new Map();

/** 물리적 그룹(parentId 소속을 바꾸는 진짜 컨테이너) — 선택한 노드들을 그 안으로 옮긴다. */
const GROUPABLE_TYPES: { type: ComponentType; label: string }[] = [
  { type: "GENERIC_GROUP", label: "그룹으로 묶기" },
  { type: "MULTI_AZ_GROUP", label: "Multi-AZ로 묶기" },
  { type: "MULTI_REGION_GROUP", label: "Multi-Region으로 묶기" },
  { type: "REGION", label: "Region으로 묶기" },
  { type: "AWS_CLOUD", label: "AWS Cloud로 묶기" },
  { type: "VPC", label: "VPC로 묶기" },
  { type: "PUBLIC_SUBNET", label: "Public Subnet으로 묶기" },
  { type: "PRIVATE_SUBNET", label: "Private Subnet으로 묶기" },
  { type: "AVAILABILITY_ZONE", label: "AZ로 묶기" },
  { type: "CORPORATE_DATACENTER", label: "사내 데이터센터로 묶기" },
];

/**
 * 논리적 그룹(Target Group, Auto Scaling Group) — parentId는 그대로 두고 data.logicalGroupId만
 * 표시로 붙인다. 그래서 서로 다른 물리적 컨테이너(서브넷 등)에 있는 노드들도 함께 묶을 수 있다.
 * Auto Scaling Group이 여기 있는 이유: 실제 AWS의 ASG는 한 서브넷에 갇히지 않고 여러 AZ에 걸쳐
 * 있는 게 정상이라, VPC/Subnet 같은 물리적 그룹으로는 표현할 수 없었다.
 */
const LOGICAL_GROUPABLE_TYPES: { type: ComponentType; label: string }[] = [
  { type: "TARGET_GROUP", label: "Target Group으로 묶기" },
  { type: "AUTO_SCALING_GROUP", label: "ASG로 묶기" },
  { type: "ECS_SERVICE", label: "ECS 서비스로 묶기" },
];

const LOGICAL_GROUP_TYPE_SET = new Set<ComponentType>(LOGICAL_GROUP_TYPES);

/** 9단계: 중첩 그룹 안에 새 그룹을 드롭할 때, 부모보다 작게 시작하도록 하는 여백. */
const NESTED_GROUP_MARGIN = 16;

/**
 * 노드 종류별 z-index. 물리 컨테이너(GroupNode)는 중첩 깊이가 깊을수록(자식일수록) 위에 그려야
 * 부모의 반투명 배경에 덮이지 않고, 논리 그룹(ASG/Target Group)은 어떤 물리 컨테이너보다도 항상
 * 위, 실제 컴포넌트(리프 노드)는 항상 맨 위여야 가려지지 않는다.
 */
function computeZIndex(node: FlowNode, nodesById: Map<string, FlowNode>): number {
  const bias = node.data.zOrderBias ?? 0;

  if (node.type === "GENERIC_GROUP") return 0;
  if (LOGICAL_GROUP_TYPE_SET.has(node.type)) return Z_INDEX_LOGICAL_GROUP + bias;
  if (!COMPONENT_META[node.type].isGroup) return Z_INDEX_LEAF + bias;

  let depth = 0;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodesById.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentId;
  }
  return Z_INDEX_GROUP_BASE + depth * Z_INDEX_GROUP_DEPTH_STEP + bias;
}


const CanvasInner = forwardRef<ArchitectureCanvasHandle, ArchitectureCanvasProps>(function CanvasInner(
  {
    initialGraph,
    onGraphChange,
    problemNodeIds,
    exportContainerRef,
    readOnly = false,
    colorMode = "light",
    highlightedEdgeIds,
    blockedEdgeIds,
    showTrafficFlow,
    onToggleTrafficFlow,
    showTrafficRps,
    onToggleTrafficRps,
    showNodeCost,
    onToggleNodeCost,
    onCostSummaryChange,
    onSelectedElementChange,
  }: ArchitectureCanvasProps,
  ref,
) {
  const initial = graphToFlow(initialGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // F4: CDN/LOAD_BALANCER의 사용량 기반 비용도 RPS가 있어야 계산되기 때문에, "트래픽(RPS) 표시"
  // 토글과 무관하게 항상 계산해 둔다. 캔버스 위 라벨 표시만 토글로 켜고 끈다(showTrafficRps가 꺼져
  // 있으면 LeafNode에는 빈 Map을 내려줘서 아무것도 안 그리게 한다).
  const computedRpsByNodeId = useMemo(() => computeNodeRps(flowToGraph(nodes, edges)).rpsByNodeId, [nodes, edges]);
  const rpsByNodeId = showTrafficRps ? computedRpsByNodeId : EMPTY_RPS_BY_NODE_ID;
  // B10: "표시" 메뉴가 "꺼져 있지만 보여줄 게 있어요" 안내를 띄울 때 쓴다.
  const hasRpsToShow = useMemo(() => [...computedRpsByNodeId.values()].some((rps) => rps > 0), [computedRpsByNodeId]);

  // F1: "비용 보기" 토글과는 무관하게 늘 계산해 둔다 — 헤더 배지·"예상 비용" 탭은 토글 상태와
  // 상관없이 항상 최신 합계를 보여줘야 해서다(토글은 캔버스 위 라벨 표시 여부만 결정한다).
  const presetsQuery = useComponentPresets();
  const costSummary = useMemo(
    () => summarizeArchitectureCost(nodes, presetsQuery.data ?? [], computedRpsByNodeId),
    [nodes, presetsQuery.data, computedRpsByNodeId],
  );
  // F5: 캔버스 노드 라벨("$30"/점선 "미반영")이 비용 탭과 같은 계산 결과를 쓰도록, 한 번 계산한
  // costSummary.lines를 노드 id로 바로 찾아볼 수 있게 맵으로만 바꿔서 내려준다.
  const costLinesByNodeId = useMemo(() => new Map(costSummary.lines.map((line) => [line.nodeId, line])), [costSummary]);
  // B10: "표시" 메뉴의 "반영된 비용이 있어요" 안내용.
  const hasCostToShow = costSummary.resolvedCount > 0;
  const lastReportedCostSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const signature = JSON.stringify(costSummary);
    if (lastReportedCostSignatureRef.current === signature) return;
    lastReportedCostSignatureRef.current = signature;
    onCostSummaryChange?.(costSummary);
  });

  // 12단계: 트래픽 흐름 강조는 저장되는 데이터가 아니라 화면 표시 전용이라, edges 상태 자체는 안
  // 건드리고 ReactFlow에 넘기기 직전에만 animated/색상을 덧씌운다.
  const displayEdges = useMemo(() => {
    const hasHighlight = highlightedEdgeIds && highlightedEdgeIds.size > 0;
    const hasBlocked = blockedEdgeIds && blockedEdgeIds.size > 0;
    if (!hasHighlight && !hasBlocked) return edges;
    return edges.map((edge) => {
      if (blockedEdgeIds?.has(edge.id)) {
        // 14단계: IAM 권한이 없어서 실제로는 못 지나가는 구간 — 빨간 점선으로 "여기서 막힌다"를 보여준다.
        return {
          ...edge,
          style: { ...edge.style, stroke: "#dc2626", strokeWidth: 2.5, strokeDasharray: "6 4" },
          data: { ...edge.data, isTrafficFlow: false, isTrafficBlocked: true },
        };
      }
      if (highlightedEdgeIds?.has(edge.id)) {
        return {
          ...edge,
          style: { ...edge.style, stroke: "#16a34a", strokeWidth: 2.5 },
          // 12단계: "선이 한번에 다 밝아지기만 하면 실제 트래픽이 어디까지 갔는지 체감이 안 된다"는
          // 피드백 — 점선 일괄 애니메이션 대신 LabeledEdge가 선을 따라 움직이는 점(패킷)을 그리게 한다.
          data: { ...edge.data, isTrafficFlow: true },
        };
      }
      return edge;
    });
  }, [edges, highlightedEdgeIds, blockedEdgeIds]);
  const { screenToFlowPosition, deleteElements, fitView, zoomIn, zoomOut } = useReactFlow<FlowNode>();
  // 13단계: 캔버스 좌하단 도구모음 — 선택/손 도구 전환과 잠금 상태. 줌 배율은 react-flow 내부
  // zustand 스토어에서 직접 읽어와야(useStore) 버튼을 눌렀을 때 화면에 바로 반영된다.
  const [interactionMode, setInteractionMode] = useState<CanvasInteractionMode>("pan");
  const [isLocked, setIsLocked] = useState(false);
  const zoomPercent = Math.round(useStore((state) => state.transform[2]) * 100);

  useEffect(() => {
    onGraphChange(flowToGraph(nodes, edges));
  }, [nodes, edges, onGraphChange]);

  const selectedNodes = nodes.filter((node) => node.selected);
  const selectedEdges = edges.filter((edge) => edge.selected);

  /**
   * 10단계: 실행 취소/다시 실행. React Flow는 undo/redo가 기본 내장이 아니라서 직접 구현한다.
   * 드래그 한 번에도 onNodesChange가 프레임마다 여러 번 불려서, 매번 기록하면 "한 칸 되돌리기"가
   * 의미 없어진다 — 그래서 nodes/edges가 잠깐(500ms) 안 바뀌고 "멈췄을 때"만 그 순간을 기록한다.
   * isRestoringRef는 되돌리기/다시하기로 인한 변경 자체를 새 기록으로 남기지 않기 위한 표시다.
   */
  const historyRef = useRef<{ entries: { nodes: FlowNode[]; edges: FlowEdge[] }[]; index: number }>({
    entries: [{ nodes: initial.nodes, edges: initial.edges }],
    index: 0,
  });
  const isRestoringRef = useRef(false);
  const isFirstHistoryRunRef = useRef(true);
  const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirstHistoryRunRef.current) {
      isFirstHistoryRunRef.current = false;
      return;
    }
    if (isRestoringRef.current) {
      isRestoringRef.current = false;
      return;
    }
    if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = setTimeout(() => {
      const history = historyRef.current;
      history.entries = history.entries.slice(0, history.index + 1);
      history.entries.push({ nodes, edges });
      history.index = history.entries.length - 1;
    }, 500);
    return () => {
      if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
    };
  }, [nodes, edges]);

  /** Ctrl+Z 등을 누른 그 순간까지의 변경을 먼저 기록으로 확정한다 — 안 그러면 방금 한 조작이 통째로 씹힌다. */
  const flushPendingHistory = useCallback(() => {
    if (!historyDebounceRef.current) return;
    clearTimeout(historyDebounceRef.current);
    historyDebounceRef.current = null;
    const history = historyRef.current;
    const last = history.entries[history.index];
    if (last && (last.nodes !== nodes || last.edges !== edges)) {
      history.entries = history.entries.slice(0, history.index + 1);
      history.entries.push({ nodes, edges });
      history.index = history.entries.length - 1;
    }
  }, [nodes, edges]);

  const handleUndo = useCallback(() => {
    flushPendingHistory();
    const history = historyRef.current;
    if (history.index <= 0) return;
    history.index -= 1;
    const entry = history.entries[history.index];
    isRestoringRef.current = true;
    setNodes(entry.nodes);
    setEdges(entry.edges);
  }, [flushPendingHistory, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    flushPendingHistory();
    const history = historyRef.current;
    if (history.index >= history.entries.length - 1) return;
    history.index += 1;
    const entry = history.entries[history.index];
    isRestoringRef.current = true;
    setNodes(entry.nodes);
    setEdges(entry.edges);
  }, [flushPendingHistory, setNodes, setEdges]);

  /**
   * 10단계: 복사/붙여넣기. 선택한 노드의 물리적 자손(parentId 체인)과 논리적 멤버(logicalGroupId)까지
   * 함께 복사해야 "컨테이너를 복사했는데 안이 텅 빈다"가 안 생긴다. 붙여넣을 때는:
   * - 복사한 것끼리의 부모/논리그룹 관계는 새 id로 그대로 이어주고,
   * - 복사 안 된 것(원본의 부모 등)을 가리키던 관계는 끊어서 최상위로 붙여넣는다(어중간하게 남의
   *   그룹에 몰래 편입되는 걸 막기 위해서).
   */
  const clipboardRef = useRef<{ nodes: FlowNode[]; edges: FlowEdge[] } | null>(null);
  const PASTE_OFFSET = 40;

  const handleCopy = useCallback(() => {
    if (selectedNodes.length === 0) return;
    const includeIds = new Set(selectedNodes.map((node) => node.id));
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) {
        if (includeIds.has(node.id)) continue;
        if (node.parentId && includeIds.has(node.parentId)) {
          includeIds.add(node.id);
          changed = true;
        } else if (node.data.logicalGroupId && includeIds.has(node.data.logicalGroupId)) {
          includeIds.add(node.id);
          changed = true;
        }
      }
    }
    clipboardRef.current = {
      nodes: nodes.filter((node) => includeIds.has(node.id)),
      edges: edges.filter((edge) => includeIds.has(edge.source) && includeIds.has(edge.target)),
    };
  }, [nodes, edges, selectedNodes]);

  const handlePaste = useCallback(() => {
    const clipboard = clipboardRef.current;
    if (!clipboard || clipboard.nodes.length === 0) return;

    const idMap = new Map<string, string>();
    for (const node of clipboard.nodes) idMap.set(node.id, generateId());

    const pastedNodes: FlowNode[] = clipboard.nodes.map((node) => {
      const newParentId = node.parentId ? idMap.get(node.parentId) : undefined;
      const newLogicalGroupId = node.data.logicalGroupId ? idMap.get(node.data.logicalGroupId) : undefined;

      const nextData = { ...node.data };
      if (newLogicalGroupId) {
        nextData.logicalGroupId = newLogicalGroupId;
      } else {
        delete nextData.logicalGroupId;
      }

      return {
        id: idMap.get(node.id)!,
        type: node.type,
        data: nextData,
        selected: true,
        position: newParentId ? node.position : { x: node.position.x + PASTE_OFFSET, y: node.position.y + PASTE_OFFSET },
        ...(newParentId ? { parentId: newParentId } : {}),
        ...(node.width !== undefined ? { width: node.width } : {}),
        ...(node.height !== undefined ? { height: node.height } : {}),
      };
    });

    const pastedEdges: FlowEdge[] = clipboard.edges.map((edge) => ({
      id: generateId(),
      source: idMap.get(edge.source)!,
      target: idMap.get(edge.target)!,
    }));

    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), ...pastedNodes]);
    setEdges((current) => [...current.map((edge) => ({ ...edge, selected: false })), ...pastedEdges]);
  }, [setNodes, setEdges]);

  /** 선택 툴바의 "복제" — 복사하자마자 바로 붙여넣어서, 클립보드를 거치지 않고 한 번에 사본을 만든다. */
  const handleDuplicate = useCallback(() => {
    handleCopy();
    handlePaste();
  }, [handleCopy, handlePaste]);

  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
      if (isEditableTarget) return; // 이름표 편집 중엔 입력창 자체의 되돌리기 등 기본 동작을 건드리지 않는다

      const isMod = event.ctrlKey || event.metaKey;
      // 피그마처럼 V(선택 도구)/H(이동 도구)는 보조키 없이 눌렀을 때만 동작한다.
      if (!isMod) {
        const key = event.key.toLowerCase();
        if (key === "v") {
          setInteractionMode("select");
        } else if (key === "h") {
          setInteractionMode("pan");
        }
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        handleRedo();
      } else if (key === "z") {
        event.preventDefault();
        handleUndo();
      } else if (key === "y") {
        event.preventDefault();
        handleRedo();
      } else if (key === "c") {
        event.preventDefault();
        handleCopy();
      } else if (key === "v") {
        event.preventDefault();
        handlePaste();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [readOnly, handleUndo, handleRedo, handleCopy, handlePaste, setInteractionMode]);

  /**
   * 9단계: 논리적 그룹(Target Group, Auto Scaling Group)의 위치/크기는 사용자가 정하지 않고,
   * 매번 멤버 노드들의 "지금 실제 위치"를 보고 다시 계산한다 — 멤버가 서로 다른 서브넷에 있어도
   * 절대좌표로 바운딩 박스를 구해서 그 경계를 그려준다. 멤버가 다 사라지면 그룹도 같이 지우고,
   * 그룹 자체가 삭제됐는데 아직 logicalGroupId를 들고 있는 멤버가 있으면 그 표시도 지운다.
   * (오토세이브 무한루프 버그를 겪은 뒤로) 실제로 값이 달라질 때만 setNodes를 불러 무한 재계산을 막는다.
   */
  useEffect(() => {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const logicalGroups = nodes.filter((node) => LOGICAL_GROUP_TYPE_SET.has(node.type));

    const boundsUpdates = new Map<string, { position: { x: number; y: number }; width: number; height: number }>();

    for (const group of logicalGroups) {
      const members = nodes.filter((node) => node.data.logicalGroupId === group.id);
      // 멤버가 없으면(막 팔레트에서 드롭했거나, 마지막 멤버를 뺀 경우) 자동으로 지우지 않는다 —
      // 물리적 그룹처럼 빈 채로 남겨두고, 필요 없으면 사용자가 직접 삭제(×)하게 둔다. 이래야
      // "ASG를 먼저 캔버스에 놓고 그 위에 웹 서버를 드롭해서 채운다"는 예전 방식이 그대로 된다.
      if (members.length === 0) continue;

      const boxes = members.map((member) => {
        const abs = getAbsolutePosition(member, nodesById);
        const size = getNodeSize(member);
        return { minX: abs.x, minY: abs.y, maxX: abs.x + size.width, maxY: abs.y + size.height };
      });
      const minX = Math.min(...boxes.map((box) => box.minX)) - LOGICAL_GROUP_PADDING;
      const minY = Math.min(...boxes.map((box) => box.minY)) - LOGICAL_GROUP_PADDING;
      const maxX = Math.max(...boxes.map((box) => box.maxX)) + LOGICAL_GROUP_PADDING;
      const maxY = Math.max(...boxes.map((box) => box.maxY)) + LOGICAL_GROUP_PADDING;
      const width = maxX - minX;
      const height = maxY - minY;

      if (group.position.x !== minX || group.position.y !== minY || group.width !== width || group.height !== height) {
        boundsUpdates.set(group.id, { position: { x: minX, y: minY }, width, height });
      }
    }

    const validGroupIds = new Set(logicalGroups.map((group) => group.id));
    const danglingMemberIds = new Set(
      nodes.filter((node) => node.data.logicalGroupId && !validGroupIds.has(node.data.logicalGroupId)).map((node) => node.id),
    );

    if (boundsUpdates.size === 0 && danglingMemberIds.size === 0) return;

    setNodes((current) =>
      current.map((node) => {
        const update = boundsUpdates.get(node.id);
        if (update) return { ...node, ...update };
        if (danglingMemberIds.has(node.id)) {
          const nextData = { ...node.data };
          delete nextData.logicalGroupId;
          return { ...node, data: nextData };
        }
        return node;
      }),
    );
  }, [nodes, setNodes]);

  const onConnect: OnConnect = useCallback(
    (connection) => setEdges((current) => addEdge(connection, current)),
    [setEdges],
  );

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(COMPONENT_DRAG_DATA_FORMAT) as ComponentType | "";
      if (type === "") return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const meta = COMPONENT_META[type];
      const isLogicalGroup = LOGICAL_GROUP_TYPE_SET.has(type);
      // 논리적 그룹(Target Group/ASG) 자체는 항상 최상위로 둔다 — parentId를 걸면 나중에 이 노드의
      // position을 멤버 기준 절대좌표로 재계산할 때(derivation effect) "부모 기준 상대좌표"와 헷갈린다.
      const parent = isLogicalGroup ? undefined : findGroupAt(nodes, position.x, position.y);
      // 팔레트에서 리프 컴포넌트를 기존 논리적 그룹 박스 위에 놓으면, 물리적 소속(parentId)은 그대로
      // 두고 logicalGroupId만 추가로 붙는다 — "ASG 박스 위에 웹 서버를 드롭"하던 예전 방식을 그대로 쓸 수 있다.
      const logicalGroup =
        !meta.isGroup && !isLogicalGroup ? findLogicalGroupAt(nodes, position.x, position.y) : undefined;

      let nodePosition = position;
      // 11단계: 리프 노드(웹서버/DB 등)도 직접 리사이즈할 수 있게 되면서, 그룹처럼 처음부터 실제
      // 크기를 갖고 태어나야 한다 — 안 그러면 이름 길이에 따라 박스가 자동으로 늘어나 버린다.
      let size: { width: number; height: number } = meta.isGroup || isLogicalGroup
        ? { width: DEFAULT_GROUP_WIDTH, height: DEFAULT_GROUP_HEIGHT }
        : (meta.defaultSize ?? { width: DEFAULT_LEAF_WIDTH, height: DEFAULT_LEAF_HEIGHT });

      if (parent) {
        const nodesById = new Map(nodes.map((node) => [node.id, node]));
        const parentAbs = getAbsolutePosition(parent, nodesById);
        const parentWidth = parent.width ?? DEFAULT_GROUP_WIDTH;
        const parentHeight = parent.height ?? DEFAULT_GROUP_HEIGHT;

        // 그룹을 그룹 안에 드롭하면, 부모와 똑같은 기본 크기로 넣지 않고 부모 안에 실제로
        // 들어맞도록 더 작게 만든다 — 안 그러면 자식 그룹이 부모보다 커서 헤더끼리 겹친다.
        if (meta.isGroup) {
          size = {
            width: Math.min(DEFAULT_GROUP_WIDTH, Math.max(NESTED_GROUP_MIN_WIDTH, parentWidth - NESTED_GROUP_MARGIN * 2)),
            height: Math.min(
              DEFAULT_GROUP_HEIGHT,
              Math.max(NESTED_GROUP_MIN_HEIGHT, parentHeight - GROUP_HEADER_HEIGHT - NESTED_GROUP_MARGIN * 2),
            ),
          };
        }

        const nodeWidth = size.width;
        const nodeHeight = size.height;
        // 기존 규칙(부모 없을 때는 드롭 지점이 새 노드의 좌상단)과 동일하게, 여기서도 드롭 지점을 그대로
        // 좌상단 기준 상대좌표로 쓰고, 부모 밖으로 튀어나가지 않도록 범위만 clamp한다.
        const relativeX = position.x - parentAbs.x;
        const relativeY = position.y - parentAbs.y;
        const maxX = Math.max(NESTED_GROUP_MARGIN, parentWidth - nodeWidth - NESTED_GROUP_MARGIN);
        const maxY = Math.max(GROUP_HEADER_HEIGHT + NESTED_GROUP_MARGIN, parentHeight - nodeHeight - NESTED_GROUP_MARGIN);

        nodePosition = {
          x: Math.min(Math.max(relativeX, NESTED_GROUP_MARGIN), maxX),
          y: Math.min(Math.max(relativeY, GROUP_HEADER_HEIGHT + NESTED_GROUP_MARGIN), maxY),
        };
      }

      const newNode: FlowNode = {
        id: generateId(),
        type,
        position: nodePosition,
        data: { label: meta.label, ...(logicalGroup ? { logicalGroupId: logicalGroup.id } : {}) },
        ...(parent ? { parentId: parent.id } : {}),
        ...size,
      };

      // 12단계: 지금 새로 떨어뜨린 게 컨테이너(Subnet 등)라면, 이미 캔버스에 있던 다른 노드가 그
      // 영역 안에 덮였을 수도 있다 — resolveContainment로 전체를 다시 맞춘다.
      setNodes((current) => resolveContainment([...current, newNode]));
    },
    [nodes, screenToFlowPosition, setNodes],
  );

  const groupableSelectedNodes = selectedNodes.filter((node) => !COMPONENT_META[node.type].isGroup && !node.parentId);
  const selectedGroupIds = selectedNodes.filter((node) => COMPONENT_META[node.type].isGroup).map((node) => node.id);
  // 논리적 그룹은 물리적 그룹과 달리 이미 다른 컨테이너(서브넷 등)에 속해 있어도(parentId 있어도)
  // 묶을 수 있다 — 유일한 조건은 그 자체가 논리적 그룹이 아니고, 아직 다른 논리적 그룹에
  // 안 속해 있어야 한다는 것뿐이다.
  const logicalGroupableSelectedNodes = selectedNodes.filter(
    (node) => !LOGICAL_GROUP_TYPE_SET.has(node.type) && !node.data.logicalGroupId,
  );
  const selectedLogicalGroupIds = selectedNodes
    .filter((node) => LOGICAL_GROUP_TYPE_SET.has(node.type))
    .map((node) => node.id);
  const hasSelection = selectedNodes.length > 0 || selectedEdges.length > 0;
  const zOrderableSelectedNodes = selectedNodes.filter((node) => node.type !== "GENERIC_GROUP");

  const handleDeleteSelected = useCallback(() => {
    void deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  }, [deleteElements, selectedNodes, selectedEdges]);

  /**
   * 레이어 패널에서 이름을 클릭하거나, 우측 검증 패널의 "캔버스에서 보기"를 눌렀을 때 공통으로 쓰는
   * 선택 로직 — 겹쳐 있어 클릭으로 못 고르던 노드도 여기선 바로 선택된다.
   */
  const selectNodesInternal = useCallback(
    (nodeIds: string[]) => {
      const idSet = new Set(nodeIds);
      setNodes((current) => current.map((node) => ({ ...node, selected: idSet.has(node.id) })));
      setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    },
    [setNodes, setEdges],
  );

  const handleSelectNodeFromLayerPanel = useCallback((nodeId: string) => selectNodesInternal([nodeId]), [selectNodesInternal]);

  /** 우측 패널의 "캔버스에서 보기"처럼, 부모가 특정 노드(들)를 선택하고 화면에 맞춰 보여주고 싶을 때 쓰는 통로. */
  useImperativeHandle(
    ref,
    () => ({
      selectNodes: (nodeIds: string[]) => {
        selectNodesInternal(nodeIds);
        if (nodeIds.length > 0) {
          fitView({ nodes: nodeIds.map((id) => ({ id })), duration: 300, padding: 0.3 });
        }
      },
      updateEntryTraffic: (nodeId, patch) => {
        setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)));
      },
      updateUsageBasedCostSettings: (nodeId, patch) => {
        setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)));
      },
      updateCapacitySettings: (nodeId, patch) => {
        setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)));
      },
      updateRedundancySettings: (nodeId, patch) => {
        setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)));
      },
      updateQueueSettings: (nodeId, patch) => {
        setNodes((current) => current.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node)));
      },
      updateEdgeTraffic: (edgeIds, patch) => {
        const idSet = new Set(edgeIds);
        setEdges((current) => current.map((edge) => (idSet.has(edge.id) ? { ...edge, data: { ...edge.data, ...patch } } : edge)));
      },
    }),
    [selectNodesInternal, fitView, setNodes, setEdges],
  );

  /**
   * 노드 하나만 선택돼 있고(엣지 선택은 없이) 우측 패널이 "요소 상세" 보기로 바뀔 수 있을 때,
   * 그 요소의 조상 경로(breadcrumb)와 입력/출력 연결을 계산해서 부모(ArchitectureEditor)에 올려보낸다.
   * 매 렌더마다 새 객체가 만들어지므로, 내용이 실제로 달라졌을 때만 콜백을 부르도록 signature로 가드한다.
   */
  const primaryElementInfo: SelectedElementInfo | null = useMemo(() => {
    if (selectedNodes.length !== 1 || selectedEdges.length !== 0) return null;
    const node = selectedNodes[0];
    const nodesById = new Map(nodes.map((n) => [n.id, n]));

    const breadcrumb: string[] = [];
    let parentId = node.parentId;
    while (parentId) {
      const ancestor = nodesById.get(parentId);
      if (!ancestor) break;
      breadcrumb.unshift(ancestor.data.label);
      parentId = ancestor.parentId;
    }

    // 엣지 종류(분배/호출/복제) 추정은 shared GraphNode/GraphEdge 모양을 기대해서, 지금 React Flow
    // 상태를 그 모양으로 한 번 바꿔서 넘긴다 — "트래픽(RPS) 표시" 계산과 같은 변환을 한 번 더 쓰는
    // 셈이지만, 요소 상세 패널을 열 때만(선택이 바뀔 때만) 도는 거라 가볍다.
    const graphSnapshot = flowToGraph(nodes, edges);
    const graphNodesById = new Map(graphSnapshot.nodes.map((n) => [n.id, n]));
    const graphEdgesBySourceId = new Map<string, (typeof graphSnapshot.edges)[number][]>();
    for (const graphEdge of graphSnapshot.edges) {
      const list = graphEdgesBySourceId.get(graphEdge.source) ?? [];
      list.push(graphEdge);
      graphEdgesBySourceId.set(graphEdge.source, list);
    }

    const toConnection = (edge: FlowEdge) => {
      const otherId = edge.source === node.id ? edge.target : edge.source;
      const graphEdge = graphSnapshot.edges.find((e) => e.id === edge.id);
      const kind = graphEdge ? inferEdgeKind(graphEdge, graphNodesById, graphEdgesBySourceId) : "call";
      // F6(A2): 호출값을 직접 안 정했으면 타입 쌍 기본값을 보여준다(예: 웹서버→DB Primary는 0.1)
      // — "기본값" 칩을 붙여야 해서, 그 기본값이 쓰였는지도 같이 알려준다.
      const sourceType = graphEdge ? graphNodesById.get(graphEdge.source)?.type : undefined;
      const targetType = graphEdge ? graphNodesById.get(graphEdge.target)?.type : undefined;
      const defaultCallsPerRequest = sourceType && targetType ? getDefaultCallsPerRequest(sourceType, targetType) : 1;
      const isDefaultValue = kind === "call" && graphEdge?.callsPerRequest === undefined;
      const value =
        kind === "distribution" ? (graphEdge?.distributionWeight ?? 1) : kind === "call" ? (graphEdge?.callsPerRequest ?? defaultCallsPerRequest) : undefined;

      // F9(B7): "1"이라는 입력값만 봐서는 실제로 얼마나 흐르는지 알 수 없다는 피드백 — 상류(source)
      // RPS에 분배 비율(또는 호출 배수)을 곱해서 "이 선이 실제로 나르는 RPS"를 같이 계산해 보여준다.
      let resultRps: number | undefined;
      let distributionPercent: number | undefined;
      if (graphEdge && kind !== "replication") {
        const sourceRps = computedRpsByNodeId.get(graphEdge.source);
        if (kind === "distribution") {
          const siblings = (graphEdgesBySourceId.get(graphEdge.source) ?? []).filter(
            (candidate) => graphNodesById.get(candidate.target)?.type === targetType,
          );
          const totalWeight = siblings.reduce((sum, sibling) => sum + (sibling.distributionWeight ?? 1), 0) || 1;
          distributionPercent = ((value ?? 1) / totalWeight) * 100;
          if (sourceRps !== undefined) resultRps = sourceRps * ((value ?? 1) / totalWeight);
        } else if (sourceRps !== undefined) {
          resultRps = sourceRps * (value ?? 1);
        }
      }

      return {
        edgeId: edge.id,
        nodeId: otherId,
        label: nodesById.get(otherId)?.data.label ?? otherId,
        ...(typeof edge.label === "string" && edge.label ? { edgeLabel: edge.label } : {}),
        kind,
        value,
        isDefaultValue,
        resultRps,
        distributionPercent,
      };
    };

    return {
      id: node.id,
      type: node.type,
      label: node.data.label,
      breadcrumb,
      inputs: edges.filter((edge) => edge.target === node.id).map(toConnection),
      outputs: edges.filter((edge) => edge.source === node.id).map(toConnection),
      computedRps: computedRpsByNodeId.get(node.id),
      // CDN/LOAD_BALANCER의 사용량 기반 비용 계산이 공유하는 전역 가정이라, USER가 아니어도 항상
      // "지금 그래프의 입구 노드가 가진 값"을 찾아서 내려준다(입구가 여러 개면 첫 번째 것을 쓴다).
      entryAvgResponseSizeKb: nodes.find((candidate) => candidate.type === "USER")?.data.entryAvgResponseSizeKb,
      ...(node.type === "USER" ? { entryAvgRps: node.data.entryAvgRps, entryPeakMultiplier: node.data.entryPeakMultiplier } : {}),
      ...(node.type === "CDN" ? { cdnCacheHitRatioPercent: node.data.cdnCacheHitRatioPercent } : {}),
      ...(node.type === "LOAD_BALANCER"
        ? {
            albConnectionReuse: node.data.albConnectionReuse,
            albRequestsPerConnection: node.data.albRequestsPerConnection,
            albAcceptPartialCost: node.data.albAcceptPartialCost,
          }
        : {}),
      ...(PRESET_SELECTABLE_TYPES.includes(node.type)
        ? { presetCode: node.data.presetCode, instanceCount: node.data.instanceCount }
        : {}),
      ...(node.type === "APP_RUNNER" ? { appRunnerMinInstanceCount: node.data.appRunnerMinInstanceCount } : {}),
      ...(node.type === "SQS" || node.type === "KINESIS_DATA_STREAMS"
        ? { queueConsumerThroughputRps: node.data.queueConsumerThroughputRps }
        : {}),
      // 14단계: 컴퓨트 노드 전용 — 이 노드와 직접 연결된 IAM 노드들(권한 부여 토글용).
      ...(COMPUTE_COMPONENT_TYPES.includes(node.type)
        ? {
            iamConnections: edges
              .filter((edge) => edge.source === node.id || edge.target === node.id)
              .flatMap((edge) => {
                const otherId = edge.source === node.id ? edge.target : edge.source;
                const otherNode = nodesById.get(otherId);
                if (otherNode?.type !== "IAM") return [];
                return [{ edgeId: edge.id, iamNodeLabel: otherNode.data.label, granted: edge.data?.iamPermissionGranted !== false }];
              }),
          }
        : {}),
    };
  }, [selectedNodes, selectedEdges, nodes, edges, computedRpsByNodeId]);

  const lastReportedElementSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    const signature = primaryElementInfo ? JSON.stringify(primaryElementInfo) : null;
    if (lastReportedElementSignatureRef.current === signature) return;
    lastReportedElementSignatureRef.current = signature;
    onSelectedElementChange?.(primaryElementInfo);
  });

  /**
   * 10단계(z-order 보정): 같은 등급(같은 깊이의 물리 컨테이너끼리, 혹은 리프 노드끼리)끼리 겹칠 때
   * 어떤 걸 위로 둘지 사용자가 직접 정한다. GENERIC_GROUP(항상 0으로 바닥에 깔림)은 보정 대상에서 뺀다.
   */
  const handleShiftZOrder = useCallback(
    (delta: number) => {
      const targetIds = new Set(selectedNodes.filter((node) => node.type !== "GENERIC_GROUP").map((node) => node.id));
      if (targetIds.size === 0) return;
      setNodes((current) =>
        current.map((node) => {
          if (!targetIds.has(node.id)) return node;
          const nextBias = Math.min(Z_ORDER_BIAS_MAX, Math.max(Z_ORDER_BIAS_MIN, (node.data.zOrderBias ?? 0) + delta));
          return { ...node, data: { ...node.data, zOrderBias: nextBias } };
        }),
      );
    },
    [selectedNodes, setNodes],
  );

  /**
   * GENERIC_GROUP(안 보이는 병합 그룹) 멤버를 드래그하면 나머지 멤버도 같은 만큼 같이 움직인다.
   *
   * React Flow의 "여러 개 선택 후 드래그하면 다 같이 움직인다"는 기본 동작은 드래그를 시작하는
   * *그 순간* 이미 선택돼 있어야만 작동한다 — 즉 한 번 클릭해서 선택해둔 다음, 별도로 다시
   * 잡고 끌어야 전체가 움직인다. 방금 묶은 그룹을 바로 한 번의 드래그로 옮기려 하면(클릭 없이
   * 바로 잡고 끄는 가장 자연스러운 동작) 그 시점엔 아직 아무것도 선택돼 있지 않아서, 마우스가
   * 눌린 그 노드 하나만 움직이고 나머지는 제자리에 남는다 — 이게 "따로 움직인다"고 느낀 원인이다.
   *
   * 그래서 선택 여부와 무관하게, 드래그 시작 시점의 형제 노드 위치를 저장해뒀다가(onNodeDragStart)
   * 드래그 중 매 프레임(onNodeDrag) 이동한 만큼(delta)을 형제들에게 그대로 적용한다.
   */
  const groupDragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  // 12단계: detachDescendants로 자손을 떼어내기 "직전"의 조상-자손 관계 스냅샷. 드래그가 끝나면
  // resolveContainment에 넘겨서, 떼어내는 동안 끊긴 연결고리를 틈타 뒤집힌 소속이 생기는 걸 막는다.
  const draggedSubtreeSnapshotRef = useRef<Map<string, string | undefined> | null>(null);
  /** 플로팅 툴바가 왼쪽 컴포넌트 패널 위로 넘어가지 않도록, 캔버스 영역 경계를 재는 데 쓴다. */
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  // 매 렌더마다 새 함수를 넘기면 React가 ref를 매번 떼었다 다시 붙이는데, 그 "떼어진" 순간에
  // 자식(SelectionToolbar)의 useLayoutEffect가 먼저 읽어버려 null을 보는 경우가 있었다. 함수
  // 정체성을 고정해서, 마운트/언마운트 때만 붙고 떨어지게 한다.
  const setCanvasWrapperRef = useCallback(
    (el: HTMLDivElement | null) => {
      canvasWrapperRef.current = el;
      if (exportContainerRef) exportContainerRef.current = el;
    },
    [exportContainerRef],
  );

  /**
   * 툴바의 "텍스트 박스" 도구 — 피그마의 Text 도구처럼, 팔레트까지 안 가도 바로 하나 떨어뜨린다.
   * 지금 보이는 화면 한가운데(뷰포트 중앙)에 놓고, 바로 이름을 고칠 수 있도록 선택 도구로 바꾸고 선택해둔다.
   */
  const handleAddTextBoxTool = useCallback(() => {
    const container = canvasWrapperRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const meta = COMPONENT_META.TEXT_BOX;
    const size = meta.defaultSize ?? { width: DEFAULT_LEAF_WIDTH, height: DEFAULT_LEAF_HEIGHT };
    const center = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const newNode: FlowNode = {
      id: generateId(),
      type: "TEXT_BOX",
      position: { x: center.x - size.width / 2, y: center.y - size.height / 2 },
      data: { label: meta.label },
      selected: true,
      ...size,
    };
    setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), newNode]);
    setEdges((current) => current.map((edge) => ({ ...edge, selected: false })));
    setInteractionMode("select");
  }, [screenToFlowPosition, setNodes, setEdges]);

  const onNodeDragStart = useCallback(
    (_event: MouseEvent | TouchEvent, node: FlowNode) => {
      // 12단계: 컨테이너(물리적 그룹)를 옮기기 시작하면, 지금 들어 있던 자손(자식, 손자, …)을
      // 먼저 절대좌표로 떼어놓는다 — 드래그 도중 안 끌려오게 하고, 다 옮긴 뒤 resolveContainment가
      // 그 자리에 걸리는 것만 다시 소속시키게 한다.
      if (COMPONENT_META[node.type].isGroup) {
        draggedSubtreeSnapshotRef.current = snapshotSubtreeParents(nodes, node.id);
        setNodes((current) => detachDescendants(current, node.id));
      } else {
        draggedSubtreeSnapshotRef.current = null;
      }

      if (!node.parentId) return;
      const parent = nodes.find((n) => n.id === node.parentId);
      if (!parent || parent.type !== "GENERIC_GROUP") return;
      const siblings = nodes.filter((n) => n.parentId === node.parentId);
      groupDragStartPositionsRef.current = new Map(siblings.map((n) => [n.id, { ...n.position }]));
    },
    [nodes, setNodes],
  );

  const onNodeDrag = useCallback(
    (_event: MouseEvent | TouchEvent, node: FlowNode) => {
      const startPositions = groupDragStartPositionsRef.current;
      const draggedStart = startPositions.get(node.id);
      if (!node.parentId || !draggedStart) return;

      const delta = { x: node.position.x - draggedStart.x, y: node.position.y - draggedStart.y };
      setNodes((current) =>
        current.map((n) => {
          if (n.id === node.id || n.parentId !== node.parentId) return n;
          const start = startPositions.get(n.id);
          if (!start) return n;
          return { ...n, position: { x: start.x + delta.x, y: start.y + delta.y } };
        }),
      );
    },
    [setNodes],
  );

  /**
   * 12단계: "컨테이너 박스 위로 기존 노드를 드래그해서 옮겨도 실제 소속(parentId)은 안 바뀐다"는
   * 버그 리포트 — 지금까지는 팔레트에서 "새로" 드롭할 때만 findGroupAt으로 소속을 정했고, 이미 캔버스에
   * 있는 노드를 드래그로 옮기는 건 다루지 않았다(위 findGroupAt 주석 참고). resolveContainment를
   * 전체 노드에 다시 돌려서, 옮긴 노드 자신의 소속은 물론 — 옮긴 게 컨테이너였다면 그 컨테이너가
   * 새로 덮게 된 다른 노드들의 소속까지 한 번에 맞춘다.
   */
  const onNodeDragStop = useCallback(() => {
    const snapshot = draggedSubtreeSnapshotRef.current ?? undefined;
    draggedSubtreeSnapshotRef.current = null;
    setNodes((current) => resolveContainment(current, snapshot));
  }, [setNodes]);

  /**
   * 선택에 물리적 그룹(VPC/Subnet 등) 또는 논리적 그룹(Target Group/ASG)이 포함되어 있으면 둘 다 해제한다.
   * - 물리적 그룹: 그 그룹(들)을 지우고 자식들을 절대좌표로 되돌린다. 그룹 자신이 또 다른 그룹에
   *   중첩되어 있을 수 있어서(Region 안의 VPC를 해제하는 경우 등), parent.position을 그냥 더하지
   *   않고 조상 체인 전체를 더한 진짜 절대좌표(getAbsolutePosition)로 복원한다.
   * - 논리적 그룹: 멤버들의 logicalGroupId만 지우고(실제 위치는 그대로 두고) 그룹 자체를 지운다.
   */
  const handleUngroupSelection = useCallback(() => {
    const groupIds = new Set(selectedGroupIds);
    const logicalGroupIds = new Set(selectedLogicalGroupIds);
    if (groupIds.size === 0 && logicalGroupIds.size === 0) return;

    setNodes((current) => {
      const nodesById = new Map(current.map((n) => [n.id, n]));
      return current
        .filter((n) => !groupIds.has(n.id) && !logicalGroupIds.has(n.id))
        .map((n) => {
          let next = n;
          if (next.parentId && groupIds.has(next.parentId)) {
            const abs = getAbsolutePosition(next, nodesById);
            next = {
              id: next.id,
              type: next.type,
              data: next.data,
              position: abs,
              selected: false,
              ...(next.width !== undefined ? { width: next.width } : {}),
              ...(next.height !== undefined ? { height: next.height } : {}),
            };
          }
          if (next.data.logicalGroupId && logicalGroupIds.has(next.data.logicalGroupId)) {
            const nextData = { ...next.data };
            delete nextData.logicalGroupId;
            next = { ...next, data: nextData };
          }
          return next;
        });
    });
  }, [selectedGroupIds, selectedLogicalGroupIds, setNodes]);

  /**
   * 선택된 노드들을 논리적 그룹(Target Group 또는 Auto Scaling Group)으로 묶는다. 물리적
   * 묶기(handleGroupSelection)와 달리 parentId는 절대 건드리지 않는다 — 서로 다른 서브넷에
   * 있던 노드들이 그 자리 그대로, data.logicalGroupId만 공유하게 된다. 실제 위치/크기는 위의
   * useEffect가 매번 다시 계산해준다.
   */
  const handleCreateLogicalGroup = useCallback(
    (groupType: ComponentType) => {
      const targets = logicalGroupableSelectedNodes;
      if (targets.length === 0) return;

      const groupId = generateId();
      const targetIds = new Set(targets.map((node) => node.id));
      const placeholderGroup: FlowNode = {
        id: groupId,
        type: groupType,
        position: { x: 0, y: 0 },
        width: NESTED_GROUP_MIN_WIDTH,
        height: NESTED_GROUP_MIN_HEIGHT,
        data: { label: COMPONENT_META[groupType].label },
      };

      setNodes((current) => [
        ...current.map((node) =>
          targetIds.has(node.id) ? { ...node, data: { ...node.data, logicalGroupId: groupId }, selected: false } : node,
        ),
        placeholderGroup,
      ]);
    },
    [logicalGroupableSelectedNodes, setNodes],
  );

  /**
   * 선택된 노드들을 감싸는 새 그룹 노드를 만들고, 선택 노드들을 그 자식으로 옮긴다.
   * React Flow는 "부모가 배열에서 자식보다 앞에 와야 한다"는 제약이 있어서
   * setNodes로 새 배열을 만들 때 그룹 노드를 맨 앞에 둔다.
   *
   * GENERIC_GROUP(화면에 안 보이는 순수 병합)은 여백/헤더 공간이 필요 없어서 패딩을 0으로 두고,
   * extent:"parent"도 안 걸어서 안 보이는 경계 안에 억지로 가두지 않는다.
   * 어느 쪽이든 각 자식의 position은 "그룹 기준 상대좌표 = 원래 절대좌표 - 그룹 위치"로만 바뀌므로
   * 화면상 절대 위치와 서로 간의 상대 위치는 그대로 유지된다.
   */
  const handleGroupSelection = useCallback(
    (groupType: ComponentType) => {
      const targets = groupableSelectedNodes;
      if (targets.length === 0) return;

      const isInvisible = groupType === "GENERIC_GROUP";
      const padding = isInvisible ? 0 : GROUP_PADDING;
      const headerOffset = isInvisible ? 0 : GROUP_HEADER_HEIGHT;

      const sizes = targets.map((node) => ({ node, size: getNodeSize(node) }));
      const minX = Math.min(...sizes.map(({ node }) => node.position.x));
      const minY = Math.min(...sizes.map(({ node }) => node.position.y));
      const maxX = Math.max(...sizes.map(({ node, size }) => node.position.x + size.width));
      const maxY = Math.max(...sizes.map(({ node, size }) => node.position.y + size.height));

      const groupPosition = { x: minX - padding, y: minY - padding - headerOffset };
      const groupWidth = maxX - minX + padding * 2;
      const groupHeight = maxY - minY + padding * 2 + headerOffset;

      const groupId = generateId();
      const groupNode: FlowNode = {
        id: groupId,
        type: groupType,
        position: groupPosition,
        data: { label: COMPONENT_META[groupType].label },
        width: groupWidth,
        height: groupHeight,
      };

      const targetIds = new Set(targets.map((node) => node.id));
      setNodes((current) => {
        const rest = current.filter((node) => !targetIds.has(node.id));
        const reparented = targets.map((node) => ({
          ...node,
          parentId: groupId,
          position: { x: node.position.x - groupPosition.x, y: node.position.y - groupPosition.y },
          selected: false,
        }));
        return [groupNode, ...rest, ...reparented];
      });
    },
    [groupableSelectedNodes, setNodes],
  );

  const nodesWithZIndex = useMemo(() => {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    return nodes.map((node) => ({ ...node, zIndex: computeZIndex(node, nodesById) }));
  }, [nodes]);

  return (
    <ProblemNodesProvider value={problemNodeIds ?? EMPTY_PROBLEM_NODE_IDS}>
      <ReadOnlyProvider value={readOnly}>
        <TrafficRpsProvider value={rpsByNodeId}>
        <NodeCostProvider value={showNodeCost ?? false}>
        <NodeCostLineProvider value={costLinesByNodeId}>
        <div className="flex h-full w-full dark:bg-gray-900">
          {!readOnly && <LeftSidebar nodes={nodes} onSelectNode={handleSelectNodeFromLayerPanel} />}
          <div
            ref={setCanvasWrapperRef}
            // "이동(V)" 모드인데 캔버스 위 커서가 여전히 손 모양(@xyflow/react 기본 pane 커서)으로 보여서,
            // 지금 모드가 제대로 바뀐 건지 한눈에 알아보기 어렵다는 피드백으로 globals.css에서 모드별로
            // 커서를 강제로 덮어쓴다.
            data-interaction-mode={interactionMode}
            className="relative h-full flex-1 dark:bg-gray-900"
          >
            {!readOnly && onToggleTrafficFlow && onToggleTrafficRps && onToggleNodeCost && (
              <DisplayMenu
                showTrafficFlow={showTrafficFlow ?? false}
                onToggleTrafficFlow={onToggleTrafficFlow}
                showTrafficRps={showTrafficRps ?? false}
                onToggleTrafficRps={onToggleTrafficRps}
                hasRpsToShow={hasRpsToShow}
                showNodeCost={showNodeCost ?? false}
                onToggleNodeCost={onToggleNodeCost}
                hasCostToShow={hasCostToShow}
              />
            )}
            <ReactFlow
              nodes={nodesWithZIndex}
              edges={displayEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={readOnly ? undefined : onConnect}
              onDrop={readOnly ? undefined : onDrop}
              onDragOver={readOnly ? undefined : onDragOver}
              onNodeDragStart={readOnly ? undefined : onNodeDragStart}
              onNodeDrag={readOnly ? undefined : onNodeDrag}
              onNodeDragStop={readOnly ? undefined : onNodeDragStop}
              deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
              nodesDraggable={!readOnly && !isLocked && interactionMode !== "pan"}
              nodesConnectable={!readOnly && !isLocked && interactionMode !== "pan"}
              elementsSelectable={!readOnly && interactionMode !== "pan"}
              defaultEdgeOptions={{ type: "labeledStep", markerEnd: { type: MarkerType.ArrowClosed } }}
              panOnDrag={readOnly || interactionMode === "pan"}
              selectionOnDrag={!readOnly && interactionMode === "select"}
              fitView
              colorMode={colorMode}
            >
              <Background />
              <MiniMap pannable zoomable />
            </ReactFlow>
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
              <CanvasToolbar
                mode={interactionMode}
                onModeChange={setInteractionMode}
                zoomPercent={zoomPercent}
                onZoomIn={() => zoomIn()}
                onZoomOut={() => zoomOut()}
                onFitView={() => fitView({ duration: 300 })}
                onUndo={handleUndo}
                onRedo={handleRedo}
                isLocked={isLocked}
                onToggleLock={() => setIsLocked((prev) => !prev)}
                onAddTextBox={handleAddTextBoxTool}
                readOnly={readOnly}
              />
            </div>
            {!readOnly && hasSelection && (
              <SelectionToolbar
                boundsRef={canvasWrapperRef}
                nodes={nodes}
                selectedNodes={selectedNodes}
                selectedEdges={selectedEdges}
                groupableSelectedNodes={groupableSelectedNodes}
                logicalGroupableSelectedNodes={logicalGroupableSelectedNodes}
                groupableTypes={GROUPABLE_TYPES}
                logicalGroupableTypes={LOGICAL_GROUPABLE_TYPES}
                hasZOrderSelection={zOrderableSelectedNodes.length > 0}
                hasUngroupSelection={selectedGroupIds.length > 0 || selectedLogicalGroupIds.length > 0}
                onGroup={handleGroupSelection}
                onCreateLogicalGroup={handleCreateLogicalGroup}
                onShiftZOrder={handleShiftZOrder}
                onUngroup={handleUngroupSelection}
                onDelete={handleDeleteSelected}
                onCopy={handleCopy}
                onDuplicate={handleDuplicate}
              />
            )}
          </div>
        </div>
        </NodeCostLineProvider>
        </NodeCostProvider>
        </TrafficRpsProvider>
      </ReadOnlyProvider>
    </ProblemNodesProvider>
  );
});

export const ArchitectureCanvas = forwardRef<ArchitectureCanvasHandle, ArchitectureCanvasProps>(function ArchitectureCanvas(props, ref) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} ref={ref} />
    </ReactFlowProvider>
  );
});
