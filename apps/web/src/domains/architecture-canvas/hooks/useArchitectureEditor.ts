"use client";

import type { ArchitectureDetail, ArchitectureGraph } from "@nangman/shared-types";
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getArchitecture, updateArchitecture } from "@/lib/api";

const AUTO_SAVE_DEBOUNCE_MS = 2000;

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface UseArchitectureEditorResult {
  query: UseQueryResult<ArchitectureDetail, Error>;
  saveStatus: SaveStatus;
  /** 디바운스 대기 중이거나 저장 요청이 아직 안 끝난 변경사항이 있는지. 페이지 이탈 경고에 쓴다. */
  hasUnsavedChanges: boolean;
  handleGraphChange: (graph: ArchitectureGraph) => void;
  handleRename: (name: string) => void;
  /** 디바운스(2초)를 기다리지 않고 지금 바로 저장한다. 저장할 변경사항이 없으면 아무 일도 안 한다. */
  saveNow: () => void;
}

/** 아키텍처 조회 + 캔버스 변경을 AUTO_SAVE_DEBOUNCE_MS만큼 모았다가 PATCH하는 자동저장을 함께 관리한다. */
export function useArchitectureEditor(id: string, options?: { enabled?: boolean }): UseArchitectureEditorResult {
  const query = useQuery({
    queryKey: ["architectures", id],
    queryFn: () => getArchitecture(id),
    enabled: options?.enabled ?? true,
  });
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstChangeRef = useRef(true);
  // 12단계: 디바운스 타이머가 끝나기 전에 수동 저장/페이지 이탈 시 강제 저장을 하려면, 마지막으로
  // 받은 그래프를 어딘가에 들고 있어야 한다 — setTimeout 콜백의 클로저 말고 ref에 저장해 둔다.
  const pendingGraphRef = useRef<ArchitectureGraph | null>(null);

  const { mutate: saveGraph } = useMutation({
    mutationFn: (graph: ArchitectureGraph) => updateArchitecture(id, { graph }),
    onSuccess: () => {
      setSaveStatus("saved");
      setHasUnsavedChanges(false);
    },
    onError: () => setSaveStatus("error"),
  });

  // 이름 변경은 그래프 자동저장과 달리 debounce 없이 EditableLabel이 커밋하는 즉시 저장한다.
  // 대시보드 카드 목록(["architectures"])은 별도 쿼리라 여기서 같이 무효화해줘야 목록에도 새 이름이 반영된다.
  const { mutate: saveName } = useMutation({
    mutationFn: (name: string) => updateArchitecture(id, { name }),
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (updated) => {
      queryClient.setQueryData(["architectures", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["architectures"], exact: true });
      setSaveStatus("saved");
    },
    onError: () => setSaveStatus("error"),
  });

  const handleRename = useCallback((name: string) => saveName(name), [saveName]);

  /**
   * 12단계: "삭제처럼 한 번뿐인 동작도 디바운스를 다 기다려야 해서, 그 사이에 새로고침하면 날아간다"는
   * 버그 리포트 — 디바운스 자체(서버 부담을 줄이려고 둔 것)는 그대로 두고, 대신 "지금 바로 저장"
   * 경로를 따로 둬서 수동 저장 버튼과 페이지 이탈 시 강제 저장 둘 다에서 재사용한다.
   */
  const flushPendingSave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const graph = pendingGraphRef.current;
    if (!graph) return;
    pendingGraphRef.current = null;
    setSaveStatus("saving");
    saveGraph(graph);
  }, [saveGraph]);

  const handleGraphChange = useCallback(
    (graph: ArchitectureGraph) => {
      // ArchitectureCanvas는 마운트 직후(초기 그래프 반영) 한 번 onGraphChange를 호출한다.
      // 그건 사용자가 편집한 게 아니므로 그 최초 1회는 저장을 걸지 않는다.
      if (isFirstChangeRef.current) {
        isFirstChangeRef.current = false;
        return;
      }
      pendingGraphRef.current = graph;
      setSaveStatus("idle");
      setHasUnsavedChanges(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flushPendingSave, AUTO_SAVE_DEBOUNCE_MS);
    },
    [flushPendingSave],
  );

  // 12단계: Ctrl/Cmd+S로 수동 저장. 브라우저 기본 동작(페이지 저장 다이얼로그)은 항상 막고,
  // 입력창(이름표 편집 등)에 포커스가 있어도 저장 자체는 막을 이유가 없어서 isEditableTarget
  // 체크 없이 전역으로 둔다.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey;
      if (!isMod || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      flushPendingSave();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flushPendingSave]);

  // 12단계: 저장이 안 된 채로 새로고침/탭 닫기/다른 페이지로 이동하면 방금 한 편집이 그대로
  // 사라진다 — 떠나기 직전에 남은 변경사항을 바로 저장하고, 브라우저 자체의 "떠나시겠습니까?"
  // 확인창도 띄워서 저장이 끝나기 전에 실수로 나가는 걸 막는다.
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) return;
      flushPendingSave();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, flushPendingSave]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { query, saveStatus, hasUnsavedChanges, handleGraphChange, handleRename, saveNow: flushPendingSave };
}
