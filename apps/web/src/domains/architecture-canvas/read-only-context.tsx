"use client";

import { createContext, useContext } from "react";

/** 공유 링크로 보는 화면(7단계)에서는 편집 UI(삭제 버튼, 이름 수정, 프리셋 선택, 팔레트)를 다 숨긴다. */
const ReadOnlyContext = createContext(false);

export const ReadOnlyProvider = ReadOnlyContext.Provider;

export function useIsReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
