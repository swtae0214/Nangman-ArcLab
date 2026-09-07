"use client";

import { useReactFlow } from "@xyflow/react";

/** 노드 오른쪽 위 모서리에 붙는 단일 삭제(×) 버튼. 연결된 엣지도 함께 정리된다. */
export function NodeDeleteButton({ nodeId }: { nodeId: string }) {
  const { deleteElements } = useReactFlow();

  return (
    <button
      type="button"
      title="삭제"
      aria-label="노드 삭제"
      className="nodrag absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-xs leading-none text-gray-500 shadow-sm hover:border-red-400 hover:text-red-600"
      onClick={(event) => {
        event.stopPropagation();
        void deleteElements({ nodes: [{ id: nodeId }] });
      }}
    >
      ×
    </button>
  );
}
