"use client";

import { useEffect, useRef, useState } from "react";

interface MoreMenuButtonProps {
  onSave: () => void;
  canSave: boolean;
  isSaving: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

/** 헤더의 "⋯" 더보기 메뉴 — 자주 안 쓰는 수동 저장/다크모드 전환을 여기 묶어둔다. */
export function MoreMenuButton({ onSave, canSave, isSaving, theme, onToggleTheme }: MoreMenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title="더보기"
        aria-label="더보기"
        className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        ⋯
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onSave();
            }}
            disabled={!canSave}
            title="평소엔 마지막 변경 후 2초 뒤 자동으로 저장돼요"
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-40 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            💾 {isSaving ? "저장 중..." : "지금 바로 저장"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onToggleTheme();
            }}
            className="block w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {theme === "dark" ? "☀️ 라이트 모드로 전환" : "🌙 다크 모드로 전환"}
          </button>
        </div>
      )}
    </div>
  );
}
