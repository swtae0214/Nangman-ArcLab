"use client";

import { useEffect, useState, type FormEvent } from "react";

interface RenameArchitectureDialogProps {
  currentName: string;
  isRenaming: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

/** CreateArchitectureDialog와 같은 모달 스타일(배경 클릭/Esc로 닫기)을 그대로 따른다. */
export function RenameArchitectureDialog({ currentName, isRenaming, errorMessage, onCancel, onConfirm }: RenameArchitectureDialogProps) {
  const [name, setName] = useState(currentName);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === currentName) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-architecture-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-console-accent/20 bg-console-panel p-6 font-noto-kr"
      >
        <div id="rename-architecture-title" className="mb-4 text-[15px] font-bold text-white">
          이름 변경
        </div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-console-subtle" htmlFor="rename-architecture-name">
          아키텍처 이름
        </label>
        <input
          id="rename-architecture-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mb-1.5 w-full rounded border border-console-accent/25 bg-console-bg px-3.5 py-3 text-[13.5px] text-console-fg placeholder:text-console-muted focus:border-console-accent focus:outline-none"
        />
        {errorMessage && <p className="mb-2 text-[12.5px] text-console-critical">{errorMessage}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-console-accent/25 px-4 py-2 text-[13px] font-semibold text-console-fg hover:border-console-accent/50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isRenaming || name.trim() === "" || name.trim() === currentName}
            className="rounded bg-console-accent px-4 py-2 text-[13px] font-bold text-console-bg hover:bg-console-accent-hover disabled:opacity-60"
          >
            {isRenaming ? "변경하는 중..." : "변경"}
          </button>
        </div>
      </form>
    </div>
  );
}
