"use client";

import { useCallback, useEffect, useState } from "react";

export type EditorTheme = "light" | "dark";

const STORAGE_KEY = "nangman-editor-theme";

function readStoredTheme(): EditorTheme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

/**
 * 아키텍처 에디터 화면 전용 다크 모드 토글. 기기의 prefers-color-scheme을 보지 않고,
 * 사용자가 상단 버튼으로 직접 켠 값만 localStorage에 저장해서 따른다.
 * 서버 렌더링 시점엔 localStorage가 없으니 항상 light로 시작하고, 마운트 후에만 저장된 값을 읽는다
 * (useState 초기값에서 바로 읽으면 서버/클라이언트 첫 렌더 결과가 달라져 하이드레이션 에러가 난다).
 */
export function useEditorTheme() {
  const [theme, setTheme] = useState<EditorTheme>("light");

  useEffect(() => {
    // 서버 렌더링과 클라이언트 첫 렌더를 둘 다 "light"로 맞추기 위해 useState 초기값에서
    // localStorage를 바로 읽지 않는다 — 마운트 후에만 저장된 값으로 갱신한다(하이드레이션 에러 방지).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(readStoredTheme());
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: EditorTheme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, toggleTheme } as const;
}
