"use client";

import "@xyflow/react/dist/style.css";
import type { ArchitectureGraph, ComponentType } from "@nangman/shared-types";
import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type OnConnect,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, type DragEvent, type RefObject } from "react";
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
} from "../component-meta";
import { generateId } from "@/lib/generate-id";
import { ProblemNodesProvider } from "../problem-nodes-context";
import { ReadOnlyProvider } from "../read-only-context";
import { flowToGraph, graphToFlow, type FlowEdge, type FlowNode } from "../types";
import { COMPONENT_DRAG_DATA_FORMAT, ComponentPalette } from "./ComponentPalette";
import { LabeledEdge } from "./edges/LabeledEdge";
import { nodeTypes } from "./node-types";

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
}

const EMPTY_PROBLEM_NODE_IDS: ReadonlySet<string> = new Set();

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
];

const LOGICAL_GROUP_TYPE_SET = new Set<ComponentType>(LOGICAL_GROUP_TYPES);

/** 9단계: 중첩 그룹 안에 새 그룹을 드롭할 때, 부모보다 작게 시작하도록 하는 여백. */
const NESTED_GROUP_MARGIN = 16;

/**
 * 노드의 절대(캔버스 기준) 좌표를 구한다. React Flow는 자식 노드의 position을 "부모 기준 상대좌표"로
 * 저장하므로, 조상 체인을 따라 올라가며 각 단계의 position을 전부 더해야 진짜 절대좌표가 나온다.
 * (Region 안의 VPC 안의 Subnet처럼 2단계 이상 중첩되면 이 계산 없이는 좌표가 어긋난다.)
 */
function getAbsolutePosition(node: FlowNode, nodesById: Map<string, FlowNode>): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodesById.get(parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

/** node가 ancestorId의 후손(자식/손자/…)인지 확인한다. */
function isDescendantOf(node: FlowNode, ancestorId: string, nodesById: Map<string, FlowNode>): boolean {
  let current = node;
  while (current.parentId) {
    if (current.parentId === ancestorId) return true;
    const parent = nodesById.get(current.parentId);
    if (!parent) return false;
    current = parent;
  }
  return false;
}

/**
 * 드롭 좌표가 어떤 그룹 노드 영역 안인지 찾는다. 여러 겹으로 중첩된 그룹(Region>AZ>VPC>Subnet)이
 * 겹쳐 있으면, 가장 바깥쪽이 아니라 가장 안쪽(가장 구체적인) 그룹을 골라야 새로 놓는 컴포넌트가
 * 의도한 컨테이너에 들어간다.
 * 기존 노드를 다른 그룹으로 다시 드래그해 옮기는 것(재부모화)까지는 다루지 않고,
 * 팔레트에서 새로 드롭할 때만 그룹 소속을 계산하는 것으로 1차 범위를 잡았다.
 */
function findGroupAt(nodes: FlowNode[], x: number, y: number): FlowNode | undefined {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const candidates = nodes.filter((node) => {
    if (!COMPONENT_META[node.type].isGroup) return false;
    const abs = getAbsolutePosition(node, nodesById);
    const width = node.width ?? DEFAULT_GROUP_WIDTH;
    const height = node.height ?? DEFAULT_GROUP_HEIGHT;
    return x >= abs.x && x <= abs.x + width && y >= abs.y && y <= abs.y + height;
  });

  return candidates.reduce<FlowNode | undefined>((deepest, candidate) => {
    if (!deepest) return candidate;
    return isDescendantOf(candidate, deepest.id, nodesById) ? candidate : deepest;
  }, undefined);
}

/**
 * 드롭 좌표가 어떤 논리적 그룹(Target Group/ASG) 위인지 찾는다. 논리적 그룹은 항상 최상위(부모 없음)라
 * findGroupAt처럼 조상 체인을 따질 필요 없이 자기 position을 그대로 절대좌표로 쓰면 된다.
 * 팔레트에서 컴포넌트를 이 위에 드롭하면(예: 웹 서버를 ASG 박스 위에) parentId는 안 건드리고
 * logicalGroupId만 붙는다 — 물리적 소속과는 완전히 별개다.
 */
function findLogicalGroupAt(nodes: FlowNode[], x: number, y: number): FlowNode | undefined {
  const logicalTypes = new Set(LOGICAL_GROUP_TYPES);
  return nodes.find((node) => {
    if (!logicalTypes.has(node.type)) return false;
    const width = node.width ?? DEFAULT_GROUP_WIDTH;
    const height = node.height ?? DEFAULT_GROUP_HEIGHT;
    return x >= node.position.x && x <= node.position.x + width && y >= node.position.y && y <= node.position.y + height;
  });
}

/** 노드의 대략적인 화면 크기. 실측(measured)값이 있으면 그걸, 없으면 타입에 맞는 기본값을 쓴다. */
function getNodeSize(node: FlowNode): { width: number; height: number } {
  const isGroup = COMPONENT_META[node.type].isGroup;
  return {
    width: node.width ?? node.measured?.width ?? (isGroup ? DEFAULT_GROUP_WIDTH : DEFAULT_LEAF_WIDTH),
    height: node.height ?? node.measured?.height ?? (isGroup ? DEFAULT_GROUP_HEIGHT : DEFAULT_LEAF_HEIGHT),
  };
}

function CanvasInner({ initialGraph, onGraphChange, problemNodeIds, exportContainerRef, readOnly = false }: ArchitectureCanvasProps) {
  const initial = graphToFlow(initialGraph);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const { screenToFlowPosition, deleteElements } = useReactFlow<FlowNode>();

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
        ...(newParentId ? { parentId: newParentId, extent: "parent" as const } : {}),
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

  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditableTarget = Boolean(target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable));
      if (isEditableTarget) return; // 이름표 편집 중엔 입력창 자체의 되돌리기 등 기본 동작을 건드리지 않는다

      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod) return;

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
  }, [readOnly, handleUndo, handleRedo, handleCopy, handlePaste]);

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
      let size: { width: number; height: number } | undefined =
        meta.isGroup || isLogicalGroup ? { width: DEFAULT_GROUP_WIDTH, height: DEFAULT_GROUP_HEIGHT } : undefined;

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

        const nodeWidth = size?.width ?? DEFAULT_LEAF_WIDTH;
        const nodeHeight = size?.height ?? DEFAULT_LEAF_HEIGHT;
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
        ...(parent ? { parentId: parent.id, extent: "parent" as const } : {}),
        ...(size ? size : {}),
      };

      setNodes((current) => [...current, newNode]);
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

  const handleDeleteSelected = useCallback(() => {
    void deleteElements({ nodes: selectedNodes, edges: selectedEdges });
  }, [deleteElements, selectedNodes, selectedEdges]);

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

  const onNodeDragStart = useCallback(
    (_event: MouseEvent | TouchEvent, node: FlowNode) => {
      if (!node.parentId) return;
      const parent = nodes.find((n) => n.id === node.parentId);
      if (!parent || parent.type !== "GENERIC_GROUP") return;
      const siblings = nodes.filter((n) => n.parentId === node.parentId);
      groupDragStartPositionsRef.current = new Map(siblings.map((n) => [n.id, { ...n.position }]));
    },
    [nodes],
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
        zIndex: 1000,
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
          ...(isInvisible ? {} : { extent: "parent" as const }),
          position: { x: node.position.x - groupPosition.x, y: node.position.y - groupPosition.y },
          selected: false,
        }));
        return [groupNode, ...rest, ...reparented];
      });
    },
    [groupableSelectedNodes, setNodes],
  );

  return (
    <ProblemNodesProvider value={problemNodeIds ?? EMPTY_PROBLEM_NODE_IDS}>
      <ReadOnlyProvider value={readOnly}>
        <div className="flex h-full w-full">
          {!readOnly && <ComponentPalette />}
          <div ref={exportContainerRef} className="h-full flex-1">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={readOnly ? undefined : onConnect}
              onDrop={readOnly ? undefined : onDrop}
              onDragOver={readOnly ? undefined : onDragOver}
              onNodeDragStart={readOnly ? undefined : onNodeDragStart}
              onNodeDrag={readOnly ? undefined : onNodeDrag}
              deleteKeyCode={readOnly ? null : ["Backspace", "Delete"]}
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              elementsSelectable={!readOnly}
              defaultEdgeOptions={{ type: "labeledStep", markerEnd: { type: MarkerType.ArrowClosed } }}
              panOnDrag
              fitView
            >
              <Background />
              <Controls showInteractive={!readOnly} />
              <MiniMap pannable zoomable />
              {!readOnly && hasSelection && (
                <Panel position="top-right">
                  <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white p-2 shadow-sm">
                    {groupableSelectedNodes.length > 0 &&
                      GROUPABLE_TYPES.map(({ type, label }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleGroupSelection(type)}
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm hover:bg-gray-50"
                        >
                          {label}
                        </button>
                      ))}
                    {logicalGroupableSelectedNodes.length > 0 &&
                      LOGICAL_GROUPABLE_TYPES.map(({ type, label }) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleCreateLogicalGroup(type)}
                          className="rounded-md border border-red-300 bg-white px-2 py-1 text-xs text-red-600 shadow-sm hover:bg-red-50"
                        >
                          {label}
                        </button>
                      ))}
                    {(selectedGroupIds.length > 0 || selectedLogicalGroupIds.length > 0) && (
                      <button
                        type="button"
                        onClick={handleUngroupSelection}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm hover:bg-gray-50"
                      >
                        그룹 해제
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleDeleteSelected}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-red-600 shadow-sm hover:border-red-400 hover:bg-red-50"
                    >
                      삭제
                    </button>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          </div>
        </div>
      </ReadOnlyProvider>
    </ProblemNodesProvider>
  );
}

export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
