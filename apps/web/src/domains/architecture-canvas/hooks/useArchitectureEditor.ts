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
  handleGraphChange: (graph: ArchitectureGraph) => void;
  handleRename: (name: string) => void;
}

/** 아키텍처 조회 + 캔버스 변경을 AUTO_SAVE_DEBOUNCE_MS만큼 모았다가 PATCH하는 자동저장을 함께 관리한다. */
export function useArchitectureEditor(id: string): UseArchitectureEditorResult {
  const query = useQuery({ queryKey: ["architectures", id], queryFn: () => getArchitecture(id) });
  const queryClient = useQueryClient();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstChangeRef = useRef(true);

  const { mutate: saveGraph } = useMutation({
    mutationFn: (graph: ArchitectureGraph) => updateArchitecture(id, { graph }),
    onSuccess: () => setSaveStatus("saved"),
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

  const handleGraphChange = useCallback(
    (graph: ArchitectureGraph) => {
      // ArchitectureCanvas는 마운트 직후(초기 그래프 반영) 한 번 onGraphChange를 호출한다.
      // 그건 사용자가 편집한 게 아니므로 그 최초 1회는 저장을 걸지 않는다.
      if (isFirstChangeRef.current) {
        isFirstChangeRef.current = false;
        return;
      }
      setSaveStatus("idle");
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setSaveStatus("saving");
        saveGraph(graph);
      }, AUTO_SAVE_DEBOUNCE_MS);
    },
    // useMutation()이 반환하는 mutation 객체 전체를 deps에 넣으면 상태(idle/pending/success)가 바뀔 때마다
    // 참조가 바뀌어서 handleGraphChange가 매번 재생성되고, 그게 ArchitectureCanvas의 useEffect를 다시 돌려
    // onGraphChange를 또 부르는 무한 루프(같은 내용을 계속 PATCH)가 생겼었다.
    // mutate 함수 자체는 TanStack Query가 참조를 안정적으로 유지해주므로 이것만 deps로 쓴다.
    [saveGraph],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { query, saveStatus, handleGraphChange, handleRename };
}
