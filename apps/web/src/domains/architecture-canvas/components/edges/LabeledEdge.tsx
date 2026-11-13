"use client";

import { EdgeLabelRenderer, getSmoothStepPath, useReactFlow, type EdgeProps } from "@xyflow/react";
import { useState, type KeyboardEvent } from "react";
import { useIsReadOnly } from "../../read-only-context";
import type { FlowEdge, FlowNode } from "../../types";

/**
 * 10단계: 연결선을 항상 직각(smoothstep, borderRadius 0)으로 그리고, 그 위에 텍스트 라벨을 달 수
 * 있게 한 커스텀 엣지. BaseEdge를 안 쓴 이유: BaseEdge의 넓은 클릭 히트 영역(interaction path)은
 * 이벤트 핸들러를 못 붙이게 돼있어서, "선을 더블클릭하면 라벨 편집"을 하려면 이 히트 영역을
 * 직접 그려야 한다. 라벨이 아직 없는 선은 라벨 칩이 안 보이니, 선 자체(투명한 두꺼운 경로)를
 * 더블클릭해도 편집이 시작되게 했다.
 */
export function LabeledEdge({
  id,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  markerEnd,
  style,
  label,
}: EdgeProps<FlowEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 0,
  });

  const { setEdges } = useReactFlow<FlowNode, FlowEdge>();
  const isReadOnly = useIsReadOnly();
  const currentLabel = typeof label === "string" ? label : "";
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(currentLabel);

  const startEditing = () => {
    if (isReadOnly) return;
    setDraft(currentLabel);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed === currentLabel) return;
    setEdges((edges) => edges.map((edge) => (edge.id === id ? { ...edge, label: trimmed } : edge)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(currentLabel);
      setIsEditing(false);
    }
  };

  return (
    <>
      <path d={edgePath} fill="none" className="react-flow__edge-path" style={style} markerEnd={markerEnd} />
      {!isReadOnly && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={18}
          style={{ cursor: "pointer" }}
          onDoubleClick={(event) => {
            event.stopPropagation();
            startEditing();
          }}
        />
      )}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: "absolute",
            pointerEvents: "all",
            // 10단계: 라벨이 그룹 박스 등 다른 요소에 깔려 안 보인다는 피드백 — 어떤 노드(리프 최대
            // 900)보다도 항상 위에 뜨도록 그 등급보다 큰 값을 고정으로 준다.
            zIndex: 1000,
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {isEditing ? (
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              onClick={(event) => event.stopPropagation()}
              placeholder="라벨"
              className="rounded border border-blue-400 bg-white px-1.5 py-0.5 text-[11px] outline-none dark:bg-gray-800 dark:text-gray-100"
              style={{ width: `${Math.max(48, draft.length * 7 + 16)}px` }}
            />
          ) : (
            currentLabel && (
              <span
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  startEditing();
                }}
                title={isReadOnly ? undefined : "더블클릭해서 라벨 수정"}
                // 10단계: 연한 회색 테두리/글씨라 안 겹쳐도 눈에 안 띈다는 피드백 — 테두리를 더 두껍고
                // 진하게, 글씨를 더 크고 굵게, 그림자를 더 뚜렷하게 바꿔 배경과의 대비를 키웠다.
                className={`rounded border-2 border-gray-500 bg-white px-2 py-1 text-xs font-semibold text-gray-900 shadow-md dark:border-gray-300 dark:bg-gray-800 dark:text-gray-100 ${
                  isReadOnly ? "" : "cursor-text"
                }`}
              >
                {currentLabel}
              </span>
            )
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
