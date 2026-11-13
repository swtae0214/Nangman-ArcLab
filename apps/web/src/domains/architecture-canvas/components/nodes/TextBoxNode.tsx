"use client";

import { NodeResizer, useReactFlow, type NodeProps } from "@xyflow/react";
import { useState, type KeyboardEvent } from "react";
import {
  DEFAULT_TEXT_BOX_FONT_SIZE,
  TEXT_BOX_FONT_SIZE_CLASSES,
  TEXT_BOX_MIN_HEIGHT,
  TEXT_BOX_MIN_WIDTH,
} from "../../component-meta";
import { useIsReadOnly } from "../../read-only-context";
import type { FlowNode } from "../../types";
import { NodeDeleteButton } from "../NodeDeleteButton";

/**
 * 11단계: 리소스에 안 걸린 자유 텍스트 — 다이어그램에 제목이나 메모를 달 때 쓴다. 연결선을 달 수 없게
 * Handle은 아예 안 둔다. 리프 노드와 달리 여러 줄을 받아야 해서(EditableLabel의 <input> 대신)
 * 더블클릭하면 <textarea>로 바뀌는 편집을 이 컴포넌트 안에 직접 둔다. 글자 크기는 자유 입력 대신
 * 작게/보통/크게 세 단계로만 고르게 해서 더 쉽게 쓰게 했다.
 */
export function TextBoxNode({ id, data, selected }: NodeProps<FlowNode>) {
  const { setNodes } = useReactFlow<FlowNode>();
  const isReadOnly = useIsReadOnly();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(data.label);
  const fontSize = data.fontSize ?? DEFAULT_TEXT_BOX_FONT_SIZE;

  const startEditing = () => {
    if (isReadOnly) return;
    setDraft(data.label);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed === "" || trimmed === data.label) return;
    setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label: trimmed } } : node)));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      setDraft(data.label);
      setIsEditing(false);
    }
    // Enter는 줄바꿈으로 그냥 쓰이게 두고(여러 줄 메모라 commit 트리거로 안 쓴다), 포커스 아웃으로만 저장한다.
  };

  const handleFontSizeChange = (nextFontSize: "sm" | "md" | "lg") => {
    setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, fontSize: nextFontSize } } : node)));
  };

  return (
    // overflow-hidden은 내용물만 가두는 안쪽 박스에만 건다 — 바깥쪽(이 div)까지 걸면 모서리 밖으로
    // 살짝 튀어나오게 둔 삭제(×) 버튼이 잘려 보인다(리사이즈 기능을 넣을 때 LeafNode에서도 겪은 버그).
    <div className="relative h-full w-full">
      <NodeResizer
        isVisible={!isReadOnly && selected}
        minWidth={TEXT_BOX_MIN_WIDTH}
        minHeight={TEXT_BOX_MIN_HEIGHT}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded !border !border-blue-400 !bg-white dark:!bg-gray-800"
      />
      {!isReadOnly && <NodeDeleteButton nodeId={id} />}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-dashed border-gray-300 bg-white/70 px-2 py-1.5 dark:border-gray-600 dark:bg-gray-800/70">
        {!isReadOnly && (
          <select
            value={fontSize}
            onChange={(event) => handleFontSizeChange(event.target.value as "sm" | "md" | "lg")}
            title="글자 크기"
            className="nodrag absolute left-1 top-1 rounded border border-gray-200 bg-white px-1 text-[10px] text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            <option value="sm">작게</option>
            <option value="md">보통</option>
            <option value="lg">크게</option>
          </select>
        )}
        <div className="mt-5 min-h-0 flex-1">
          {isEditing ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
              onClick={(event) => event.stopPropagation()}
              placeholder="텍스트를 입력하세요"
              className={`nodrag h-full w-full resize-none rounded border border-blue-400 bg-white p-1 outline-none dark:bg-gray-900 dark:text-gray-100 ${TEXT_BOX_FONT_SIZE_CLASSES[fontSize]}`}
            />
          ) : (
            <p
              onDoubleClick={(event) => {
                event.stopPropagation();
                startEditing();
              }}
              title={isReadOnly ? undefined : "더블클릭해서 텍스트 수정"}
              className={`nodrag h-full w-full overflow-hidden whitespace-pre-wrap break-words text-gray-800 dark:text-gray-100 ${
                isReadOnly ? "" : "cursor-text"
              } ${TEXT_BOX_FONT_SIZE_CLASSES[fontSize]}`}
            >
              {data.label || "더블클릭해서 텍스트 입력"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
