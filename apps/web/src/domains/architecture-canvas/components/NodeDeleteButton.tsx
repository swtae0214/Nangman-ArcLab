"use client";

import { useReactFlow } from "@xyflow/react";
import { getAbsolutePosition } from "../containment";
import type { FlowNode } from "../types";

/**
 * 노드 오른쪽 위 모서리에 붙는 단일 삭제(×) 버튼.
 * 12단계: "컨테이너를 지우면 안에 있던 노드까지 같이 지워진다"는 피드백 — React Flow의
 * deleteElements는 parentId로 연결된 자손을 통째로 지워버린다. 대신 지우기 직전에 직계 자식들을
 * 절대좌표로 떼어놓아서(그룹 해제와 같은 방식) 컨테이너 자신만 사라지고, 안에 있던 건 지금 보이는
 * 그 자리에 그대로 남게 한다. 연결된 엣지는 평소처럼 같이 정리한다.
 */
export function NodeDeleteButton({ nodeId }: { nodeId: string }) {
  const { getNodes, setNodes, setEdges } = useReactFlow<FlowNode>();

  return (
    <button
      type="button"
      title="삭제"
      aria-label="노드 삭제"
      className="nodrag absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs leading-none text-gray-500 shadow-sm hover:border-red-400 hover:text-red-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-red-500 dark:hover:text-red-400"
      onClick={(event) => {
        event.stopPropagation();
        const nodesById = new Map(getNodes().map((node) => [node.id, node]));
        setNodes((current) =>
          current
            .filter((node) => node.id !== nodeId)
            .map((node) => {
              if (node.parentId !== nodeId) return node;
              const abs = getAbsolutePosition(node, nodesById);
              const { parentId: _oldParentId, ...rest } = node;
              return { ...rest, position: abs };
            }),
        );
        setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
      }}
    >
      ×
    </button>
  );
}
