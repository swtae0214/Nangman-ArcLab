"use client";

import { useMemo, useState } from "react";
import {
  COMPONENT_META,
  DEFAULT_LOGICAL_GROUP_BORDER_COLOR,
  LOGICAL_GROUP_BORDER_COLOR,
} from "../component-meta";
import { useResizableWidth } from "../hooks/useResizableWidth";
import type { FlowNode } from "../types";
import { ResizeHandle } from "./ResizeHandle";

interface LayerPanelProps {
  nodes: FlowNode[];
  onSelectNode: (nodeId: string) => void;
}

const LAYER_PANEL_DEFAULT_WIDTH = 256;
const LAYER_PANEL_MIN_WIDTH = 180;
const LAYER_PANEL_MAX_WIDTH = 480;

/** 부모 노드 id(최상위는 undefined) → 그 자식 노드 목록. 물리적 소속(parentId) 기준으로만 트리를 만든다. */
function buildChildrenMap(nodes: FlowNode[]): Map<string | undefined, FlowNode[]> {
  const map = new Map<string | undefined, FlowNode[]>();
  for (const node of nodes) {
    const list = map.get(node.parentId) ?? [];
    list.push(node);
    map.set(node.parentId, list);
  }
  return map;
}

function LayerRow({
  node,
  depth,
  childrenMap,
  nodesById,
  onSelectNode,
}: {
  node: FlowNode;
  depth: number;
  childrenMap: Map<string | undefined, FlowNode[]>;
  nodesById: Map<string, FlowNode>;
  onSelectNode: (nodeId: string) => void;
}) {
  const meta = COMPONENT_META[node.type];
  const Icon = meta.Icon;
  const children = childrenMap.get(node.id) ?? [];
  const logicalGroup = node.data.logicalGroupId ? nodesById.get(node.data.logicalGroupId) : undefined;
  const logicalGroupBorderColor = logicalGroup
    ? (LOGICAL_GROUP_BORDER_COLOR[logicalGroup.type] ?? DEFAULT_LOGICAL_GROUP_BORDER_COLOR)
    : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => onSelectNode(node.id)}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
        className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${
          node.selected ? "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "text-gray-700 dark:text-gray-200"
        }`}
      >
        <Icon size={14} />
        <span className="truncate">{node.data.label}</span>
        {logicalGroup && (
          <span
            className={`ml-auto shrink-0 rounded border px-1 text-[10px] text-gray-500 dark:text-gray-400 ${logicalGroupBorderColor}`}
          >
            {logicalGroup.data.label}
          </span>
        )}
      </button>
      {children.map((child) => (
        <LayerRow
          key={child.id}
          node={child}
          depth={depth + 1}
          childrenMap={childrenMap}
          nodesById={nodesById}
          onSelectNode={onSelectNode}
        />
      ))}
    </>
  );
}

/**
 * 10단계(레이어 패널): 캔버스에서 노드끼리 겹쳐 있으면 클릭으로 원하는 걸 못 고를 수 있어서,
 * 전체 노드를 물리적 소속(parentId) 트리로 나열해두고 이름을 클릭하면 바로 선택되게 했다.
 * 논리적 그룹(Target Group/ASG) 소속은 트리에 끼워 넣지 않고(물리적 소속과 별개라서) 배지로만 표시한다.
 */
export function LayerPanel({ nodes, onSelectNode }: LayerPanelProps) {
  const [mode, setMode] = useState<"pinned" | "collapsed">("pinned");
  const { width, handlePointerDown } = useResizableWidth({
    initialWidth: LAYER_PANEL_DEFAULT_WIDTH,
    minWidth: LAYER_PANEL_MIN_WIDTH,
    maxWidth: LAYER_PANEL_MAX_WIDTH,
    edge: "left",
  });

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const topLevelNodes = childrenMap.get(undefined) ?? [];

  const content =
    nodes.length === 0 ? (
      <p className="p-3 text-xs text-gray-400 dark:text-gray-500">아직 캔버스에 놓인 컴포넌트가 없어요.</p>
    ) : (
      <div className="flex flex-col p-2">
        {topLevelNodes.map((node) => (
          <LayerRow key={node.id} node={node} depth={0} childrenMap={childrenMap} nodesById={nodesById} onSelectNode={onSelectNode} />
        ))}
      </div>
    );

  const header = (icon: string, onToggle: () => void, title: string) => (
    <div className="flex items-center justify-between border-b border-gray-200 p-2 text-xs font-semibold text-gray-500 dark:border-gray-700 dark:text-gray-400">
      <span>레이어</span>
      <button
        type="button"
        onClick={onToggle}
        title={title}
        aria-label={title}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base text-gray-500 shadow-sm hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
      >
        {icon}
      </button>
    </div>
  );

  if (mode === "collapsed") {
    return (
      <div className="group relative w-5 shrink-0">
        {/* 평소엔 이 얇은 띠만 보인다 — 캔버스 레이아웃 폭은 그대로 유지. */}
        <div className="flex h-full w-5 flex-col items-center border-l border-gray-200 bg-white pt-3 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-base text-gray-400 dark:text-gray-500">‹</span>
        </div>
        {/*
          띠에 마우스를 올리면 캔버스 위로 떠서 펼쳐지는 미리보기. 레이아웃 폭을 안 늘리려고 absolute로 띄운다.
          평소엔 오른쪽으로 완전히 숨겨뒀다가(translate-x-full) 호버하면 왼쪽(translate-x-0)으로 슬라이드되어 나온다.
        */}
        <aside className="invisible absolute right-0 top-0 z-20 flex h-full w-64 translate-x-full flex-col border-l border-gray-200 bg-white opacity-0 shadow-lg transition-all duration-200 ease-out delay-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-0 dark:border-gray-700 dark:bg-gray-900">
          {header("📌", () => setMode("pinned"), "레이어 패널 고정하기")}
          <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
        </aside>
      </div>
    );
  }

  return (
    // 고정된 상태일 땐 z-30을 줘서, 오른쪽에 접혀 있는 검증/시뮬레이션 패널의 호버 미리보기(z-20)가
    // 이 레이어 패널 위를 덮지 못하게 한다.
    <aside
      className="relative z-30 flex shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ width }}
    >
      <ResizeHandle edge="left" onPointerDown={handlePointerDown} />
      {header("‹", () => setMode("collapsed"), "레이어 패널 접기")}
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
    </aside>
  );
}
