"use client";

import { useState } from "react";
import { useResizableWidth } from "../hooks/useResizableWidth";
import type { FlowNode } from "../types";
import { ComponentPaletteContent } from "./ComponentPalette";
import { LayerPanelContent } from "./LayerPanel";
import { ResizeHandle } from "./ResizeHandle";

interface LeftSidebarProps {
  nodes: FlowNode[];
  onSelectNode: (nodeId: string) => void;
}

const SIDEBAR_DEFAULT_WIDTH = 240;
const SIDEBAR_MIN_WIDTH = 180;
const SIDEBAR_MAX_WIDTH = 420;
/** 접혀 있을 때 마우스를 올리면 뜨는 미리보기 폭 — 드래그로 조절한 폭과 무관하게 고정값을 쓴다. */
const PREVIEW_WIDTH = 288;

type SidebarTab = "components" | "layers";

/**
 * 좌측 "컴포넌트 팔레트"와 "레이어 트리"를 탭으로 묶은 단일 사이드바.
 * 예전엔 두 패널이 캔버스 양옆에 따로 떨어져 있었는데, 디자인 목업에 맞춰 하나로 합쳤다.
 */
export function LeftSidebar({ nodes, onSelectNode }: LeftSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("components");
  const [mode, setMode] = useState<"pinned" | "collapsed">("pinned");
  const { width, handlePointerDown } = useResizableWidth({
    initialWidth: SIDEBAR_DEFAULT_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    edge: "right",
  });

  const tabBar = (onCollapseToggle: () => void, collapseIcon: string, collapseTitle: string) => (
    <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-1 items-center text-xs">
        <button
          type="button"
          onClick={() => setTab("components")}
          className={`flex-1 px-2 py-2 font-medium ${
            tab === "components"
              ? "border-b-2 border-black text-black dark:border-gray-100 dark:text-gray-100"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          컴포넌트
        </button>
        <button
          type="button"
          onClick={() => setTab("layers")}
          className={`flex-1 px-2 py-2 font-medium ${
            tab === "layers"
              ? "border-b-2 border-black text-black dark:border-gray-100 dark:text-gray-100"
              : "text-gray-400 dark:text-gray-500"
          }`}
        >
          레이어
        </button>
      </div>
      <button
        type="button"
        onClick={onCollapseToggle}
        title={collapseTitle}
        aria-label={collapseTitle}
        className="m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base text-gray-500 shadow-sm hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
      >
        {collapseIcon}
      </button>
    </div>
  );

  const content = (panelWidth: number) =>
    tab === "components" ? (
      <ComponentPaletteContent width={panelWidth} />
    ) : (
      <LayerPanelContent nodes={nodes} onSelectNode={onSelectNode} />
    );

  if (mode === "collapsed") {
    return (
      <div className="group relative w-5 shrink-0">
        {/* 평소엔 이 얇은 띠만 보인다 — 캔버스 레이아웃 폭은 그대로 유지. */}
        <div className="flex h-full w-5 flex-col items-center border-r border-gray-200 bg-white pt-3 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-base text-gray-400 dark:text-gray-500">›</span>
        </div>
        <aside className="invisible absolute left-0 top-0 z-20 flex h-full w-72 -translate-x-full flex-col border-r border-gray-200 bg-white opacity-0 shadow-lg transition-all duration-200 ease-out delay-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-0 dark:border-gray-700 dark:bg-gray-900">
          {tabBar(() => setMode("pinned"), "📌", "사이드바 고정하기")}
          <div className="min-h-0 flex-1 overflow-y-auto">{content(PREVIEW_WIDTH)}</div>
        </aside>
      </div>
    );
  }

  return (
    // 고정된 상태일 땐 z-30을 줘서, 오른쪽에 접혀 있는 다른 패널의 호버 미리보기(z-20)가 위로 덮지 못하게 한다.
    <aside
      className="relative z-30 flex shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ width }}
    >
      <ResizeHandle edge="right" onPointerDown={handlePointerDown} />
      {tabBar(() => setMode("collapsed"), "‹", "사이드바 접기")}
      <div className="min-h-0 flex-1 overflow-y-auto">{content(width)}</div>
    </aside>
  );
}
