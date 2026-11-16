"use client";

import { useEffect, useState, type FormEvent } from "react";

interface CreateArchitectureDialogProps {
  isCreating: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}

/**
 * 12단계: "새 아키텍처 생성 칸이 대시보드 상단을 늘 차지하고 있으니, 검색을 두고 생성은 버튼 +
 * 팝업으로 빼는 게 낫다"는 피드백으로 대시보드의 인라인 입력 폼을 이 팝업으로 옮겼다.
 * DeleteConfirmDialog와 같은 모달 스타일(배경 클릭/Esc로 닫기)을 그대로 따른다.
 */
export function CreateArchitectureDialog({ isCreating, errorMessage, onCancel, onConfirm }: CreateArchitectureDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") return;
    onConfirm(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-architecture-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-console-accent/20 bg-console-panel p-6 font-noto-kr"
      >
        <div id="create-architecture-title" className="mb-4 text-[15px] font-bold text-white">
          새 아키텍처 시작하기
        </div>
        <label className="mb-1.5 block text-[12.5px] font-semibold text-console-subtle" htmlFor="create-architecture-name">
          아키텍처 이름
        </label>
        <input
          id="create-architecture-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="예: 낭만인프라"
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
            disabled={isCreating || name.trim() === ""}
            className="rounded bg-console-accent px-4 py-2 text-[13px] font-bold text-console-bg hover:bg-console-accent-hover disabled:opacity-60"
          >
            {isCreating ? "만드는 중..." : "만들기"}
          </button>
        </div>
      </form>
    </div>
  );
}
