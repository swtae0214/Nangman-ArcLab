"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

interface UseResizableWidthOptions {
  initialWidth: number;
  minWidth: number;
  maxWidth: number;
  /**
   * 핸들이 패널의 어느 가장자리에 있는지 — 그에 따라 마우스를 끄는 방향과 "넓어진다"가 반대로 바뀐다.
   * "right": 팔레트처럼 캔버스 왼쪽에 있는 패널. 오른쪽으로 끌수록 넓어진다.
   * "left": 레이어/검증 패널처럼 캔버스 오른쪽에 있는 패널. 왼쪽으로 끌수록 넓어진다.
   */
  edge: "left" | "right";
}

/** 11단계: 왼쪽 팔레트·레이어 패널·오른쪽 검증 패널이 고정(pinned)돼 있을 때, 가장자리를 드래그해서 폭을 바꿀 수 있게 한다. */
export function useResizableWidth({ initialWidth, minWidth, maxWidth, edge }: UseResizableWidthOptions) {
  const [width, setWidth] = useState(initialWidth);
  const dragStartRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      dragStartRef.current = { startX: event.clientX, startWidth: width };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const dragStart = dragStartRef.current;
        if (!dragStart) return;
        const delta = moveEvent.clientX - dragStart.startX;
        const signedDelta = edge === "right" ? delta : -delta;
        setWidth(Math.min(maxWidth, Math.max(minWidth, dragStart.startWidth + signedDelta)));
      };
      const handlePointerUp = () => {
        dragStartRef.current = null;
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [width, edge, minWidth, maxWidth],
  );

  return { width, handlePointerDown };
}
