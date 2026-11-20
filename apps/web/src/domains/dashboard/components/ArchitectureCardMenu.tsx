"use client";

import { useEffect, useRef, useState } from "react";

interface ArchitectureCardMenuProps {
  onRename: () => void;
  onDuplicate: () => void;
  onCopyShareLink: () => void;
  onDeleteRequest: () => void;
}

/** 카드 우상단의 "⋯" 메뉴 — 이름 변경/복제/공유 링크 복사/삭제를 한 곳에 모은다. */
export function ArchitectureCardMenu({ onRename, onDuplicate, onCopyShareLink, onDeleteRequest }: ArchitectureCardMenuProps) {
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

  const runAndClose = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      // 카드 전체가 <Link>라서, 메뉴 버튼·항목 클릭이 그 링크 네비게이션으로 안 새게 막는다.
      onClick={(event) => event.preventDefault()}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="더보기"
        title="더보기"
        className="flex h-7 w-7 items-center justify-center rounded text-console-muted hover:bg-white/10 hover:text-console-fg"
      >
        ⋯
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-console-accent/20 bg-console-panel py-1 font-jetbrains text-[12px] shadow-lg">
          <button
            type="button"
            onClick={() => runAndClose(onRename)}
            className="block w-full px-3 py-1.5 text-left text-console-fg hover:bg-white/5"
          >
            ✎ 이름 변경
          </button>
          <button
            type="button"
            onClick={() => runAndClose(onDuplicate)}
            className="block w-full px-3 py-1.5 text-left text-console-fg hover:bg-white/5"
          >
            ⧉ 복제
          </button>
          <button
            type="button"
            onClick={() => runAndClose(onCopyShareLink)}
            className="block w-full px-3 py-1.5 text-left text-console-fg hover:bg-white/5"
          >
            🔗 공유 링크 복사
          </button>
          <div className="my-1 h-px bg-console-accent/15" />
          <button
            type="button"
            onClick={() => runAndClose(onDeleteRequest)}
            className="block w-full px-3 py-1.5 text-left text-console-critical hover:bg-white/5"
          >
            🗑 삭제
          </button>
        </div>
      )}
    </div>
  );
}
