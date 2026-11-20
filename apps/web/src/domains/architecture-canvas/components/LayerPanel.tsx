"use client";

import { useMemo } from "react";
import {
  COMPONENT_META,
  DEFAULT_LOGICAL_GROUP_BORDER_COLOR,
  LOGICAL_GROUP_BORDER_COLOR,
} from "../component-meta";
import { useProblemNodeIds } from "../problem-nodes-context";
import type { FlowNode } from "../types";

interface LayerPanelContentProps {
  nodes: FlowNode[];
  onSelectNode: (nodeId: string) => void;
}

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
  const problemNodeIds = useProblemNodeIds();
  const meta = COMPONENT_META[node.type];
  const Icon = meta.Icon;
  const children = childrenMap.get(node.id) ?? [];
  const hasProblem = problemNodeIds.has(node.id);
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
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {/* 평소엔 아무 표시도 안 하고, 검증에 실패해서 지목된 요소만 눈에 띄게 빨간 느낌표를 띄운다. */}
          {hasProblem && (
            <span title="이 요소와 관련된 검증이 실패했어요" className="text-red-500 dark:text-red-400">
              ⚠
            </span>
          )}
          {logicalGroup && (
            <span
              className={`rounded border px-1 text-[10px] text-gray-500 dark:text-gray-400 ${logicalGroupBorderColor}`}
            >
              {logicalGroup.data.label}
            </span>
          )}
        </span>
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
export function LayerPanelContent({ nodes, onSelectNode }: LayerPanelContentProps) {
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const childrenMap = useMemo(() => buildChildrenMap(nodes), [nodes]);
  const topLevelNodes = childrenMap.get(undefined) ?? [];

  if (nodes.length === 0) {
    return <p className="p-3 text-xs text-gray-400 dark:text-gray-500">아직 캔버스에 놓인 컴포넌트가 없어요.</p>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto p-2">
      {topLevelNodes.map((node) => (
        <LayerRow key={node.id} node={node} depth={0} childrenMap={childrenMap} nodesById={nodesById} onSelectNode={onSelectNode} />
      ))}
    </div>
  );
}
