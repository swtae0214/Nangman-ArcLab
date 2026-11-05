"use client";

import type { CurrentUser } from "@nangman/shared-types";
import { useEffect, useRef, useState } from "react";

interface UserMenuProps {
  user: CurrentUser;
  onLogout: () => void;
  isLoggingOut: boolean;
}

/** 대시보드 우측 상단 아바타를 누르면 뜨는 드롭다운. 지금 이 앱에 실제로 있는 기능만 넣는다
 *  (설정 페이지·다크모드 전환처럼 없는 기능은 메뉴에 올리지 않는다 — 이미 이 화면 자체가 다크 테마다). */
export function UserMenu({ user, onLogout, isLoggingOut }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        title={user.username}
        className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-console-accent font-sans text-[13px] font-bold text-console-bg"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- GitHub 아바타 외부 호스트 이미지라 next/image 도메인 허용 설정 없이 그냥 img로 처리
          <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          user.username[0]?.toUpperCase()
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-20 mt-2 w-48 rounded-md border border-console-accent/20 bg-console-panel py-1.5 font-sans shadow-lg">
          <div className="border-b border-console-accent/10 px-3.5 py-2 text-[13px] font-semibold text-white">
            {user.username}
          </div>
          <a
            href={`https://github.com/${user.username}`}
            target="_blank"
            rel="noreferrer"
            onClick={() => setIsOpen(false)}
            className="block px-3.5 py-2 text-[13px] text-console-muted hover:bg-console-accent/10 hover:text-console-fg"
          >
            GitHub 프로필 보기
          </a>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            disabled={isLoggingOut}
            className="block w-full px-3.5 py-2 text-left text-[13px] text-console-critical hover:bg-console-accent/10 disabled:opacity-60"
          >
            {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      )}
    </div>
  );
}
