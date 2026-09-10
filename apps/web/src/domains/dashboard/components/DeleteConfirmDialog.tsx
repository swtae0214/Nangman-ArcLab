"use client";

import { useEffect } from "react";

interface DeleteConfirmDialogProps {
  architectureName: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 삭제는 되돌릴 수 없는 작업이라, 카드의 "삭제" 버튼은 바로 지우지 않고 이 확인창을 먼저 띄운다. */
export function DeleteConfirmDialog({ architectureName, isDeleting, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-confirm-title"
        className="w-full max-w-sm rounded-lg border border-console-accent/20 bg-console-panel p-6 font-noto-kr"
        onClick={(event) => event.stopPropagation()}
      >
        <div id="delete-confirm-title" className="mb-2 text-[15px] font-bold text-white">
          &ldquo;{architectureName}&rdquo; 아키텍처를 삭제할까요?
        </div>
        <p className="mb-5 text-[13px] leading-[1.6] text-console-subtle">
          저장된 설계와 시뮬레이션 기록이 모두 함께 지워지고,{" "}
          <span className="font-semibold text-console-critical">삭제하면 다시 복구할 수 없어요.</span>
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-console-accent/25 px-4 py-2 text-[13px] font-semibold text-console-fg hover:border-console-accent/50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded bg-console-critical px-4 py-2 text-[13px] font-bold text-console-bg hover:opacity-90 disabled:opacity-60"
          >
            {isDeleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
