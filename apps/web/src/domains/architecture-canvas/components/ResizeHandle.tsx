"use client";

import type { PointerEvent } from "react";

interface ResizeHandleProps {
  edge: "left" | "right";
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
}

/** 패널 가장자리의 드래그-리사이즈 손잡이. 보이는 테두리 선 위에 투명하게 겹쳐서, 평소엔 안 보이다가 호버해야 파란 선으로 드러난다. */
export function ResizeHandle({ edge, onPointerDown }: ResizeHandleProps) {
  return (
    <div
      onPointerDown={onPointerDown}
      className={`group/handle absolute top-0 z-10 h-full w-1.5 cursor-col-resize ${edge === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"}`}
    >
      <div className="h-full w-full bg-transparent group-hover/handle:bg-blue-400 group-active/handle:bg-blue-500" />
    </div>
  );
}
