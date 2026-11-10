"use client";

import { useState, type KeyboardEvent } from "react";

interface EditableLabelProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
}

/**
 * 더블클릭하면 입력창으로 바뀌는 이름표. Enter/포커스아웃으로 저장, Esc로 취소.
 * "nodrag" 클래스가 없으면 React Flow가 이 클릭/드래그를 노드 이동으로 가로채버린다.
 */
export function EditableLabel({ value, onChange, className, inputClassName }: EditableLabelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const startEditing = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== "" && trimmed !== value) {
      onChange(trimmed);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      setDraft(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        onClick={(event) => event.stopPropagation()}
        className={`nodrag rounded border border-blue-400 px-1 outline-none dark:bg-gray-800 dark:text-gray-100 ${inputClassName ?? ""}`}
      />
    );
  }

  return (
    <span
      onDoubleClick={(event) => {
        event.stopPropagation();
        startEditing();
      }}
      title="더블클릭해서 이름 수정"
      className={`nodrag cursor-text ${className ?? ""}`}
    >
      {value}
    </span>
  );
}
