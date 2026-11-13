"use client";

import type { ComponentType } from "@nangman/shared-types";
import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { COMPONENT_META, COMPONENT_PALETTE_SECTIONS, type ComponentCategory } from "../component-meta";
import { useResizableWidth } from "../hooks/useResizableWidth";
import { ResizeHandle } from "./ResizeHandle";

export const COMPONENT_DRAG_DATA_FORMAT = "application/x-nangman-component-type";

const PALETTE_DEFAULT_WIDTH = 224;
const PALETTE_MIN_WIDTH = 180;
const PALETTE_MAX_WIDTH = 420;

/** 사이드바의 드래그 소스. ArchitectureCanvas의 onDrop이 이 dataTransfer 값을 읽는다. */
export function ComponentPalette() {
  const [query, setQuery] = useState("");
  /**
   * 10단계: 패널 상태를 두 단계로 나눴다.
   * - "pinned": 기본값. 항상 펼쳐진 채로 캔버스 폭을 차지한다.
   * - "collapsed": 접기 버튼을 누른 뒤의 상태. 평소엔 얇은 띠만 남아 캔버스를 넓게 쓰고,
   *   그 띠에 마우스를 올리면 캔버스 위에 떠서(레이아웃 폭은 안 늘어남) 미리보기처럼 펼쳐진다.
   *   다시 "pinned"로 못 박고 싶으면 그 미리보기 안의 핀 버튼을 누르면 된다.
   */
  const [mode, setMode] = useState<"pinned" | "collapsed">("pinned");
  const { width, handlePointerDown } = useResizableWidth({
    initialWidth: PALETTE_DEFAULT_WIDTH,
    minWidth: PALETTE_MIN_WIDTH,
    maxWidth: PALETTE_MAX_WIDTH,
    edge: "right",
  });
  /** 11단계: 카테고리 제목을 눌러서 접고 펼 수 있게 — 스크롤을 줄이고 싶다는 피드백. 기본은 전부 펼친 상태. */
  const [collapsedCategories, setCollapsedCategories] = useState<Set<ComponentCategory>>(new Set());
  const toggleCategory = (category: ComponentCategory) => {
    setCollapsedCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: ComponentType) => {
    event.dataTransfer.setData(COMPONENT_DRAG_DATA_FORMAT, type);
    event.dataTransfer.effectAllowed = "move";
  };

  // 이름에 검색어가 포함된 컴포넌트만 남기고, 결과가 하나도 없는 카테고리는 섹션째로 숨긴다.
  const filteredSections = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return COMPONENT_PALETTE_SECTIONS;
    return COMPONENT_PALETTE_SECTIONS.map((section) => ({
      category: section.category,
      types: section.types.filter((type) => COMPONENT_META[type].label.toLowerCase().includes(trimmed)),
    })).filter((section) => section.types.length > 0);
  }, [query]);

  // 검색 중일 땐 접힌 카테고리도 무시하고 결과를 그대로 보여준다 — 안 그러면 접어둔 카테고리의
  // 컴포넌트는 검색해도 안 보여서 "검색이 안 되는 줄" 오해하기 쉽다.
  const isSearching = query.trim() !== "";

  const sectionList: ReactNode =
    filteredSections.length === 0 ? (
      <p className="text-xs text-gray-400 dark:text-gray-500">&ldquo;{query}&rdquo;에 맞는 컴포넌트가 없어요.</p>
    ) : (
      filteredSections.map(({ category, types }) => {
        const isCollapsed = !isSearching && collapsedCategories.has(category);
        return (
          <div key={category} className="mb-4">
            <button
              type="button"
              onClick={() => toggleCategory(category)}
              className="mb-2 flex w-full items-center gap-1 text-xs font-semibold uppercase text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <span className={`text-[9px] transition-transform ${isCollapsed ? "" : "rotate-90"}`}>▶</span>
              {category}
            </button>
            {!isCollapsed && (
              <div className="flex flex-col gap-2">
                {types.map((type) => {
                  const meta = COMPONENT_META[type];
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      draggable
                      onDragStart={(event) => handleDragStart(event, type)}
                      // 튜토리얼 오버레이가 이 버튼을 하이라이트할 때 찾는 식별자.
                      data-tutorial-id={`palette-component-${type}`}
                      className="flex cursor-grab items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left text-sm shadow-sm hover:bg-gray-50 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                    >
                      <Icon size={24} />
                      <span>{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })
    );

  const tips = !query && (
    <div className="space-y-1 text-xs text-gray-400 dark:text-gray-500">
      <p>캔버스로 드래그해서 배치하세요.</p>
      <p>더블클릭으로 이름 수정, 노드 위 × 또는 Delete 키로 삭제할 수 있어요.</p>
      <p>Shift+드래그로 영역을 선택하면 오른쪽 위에 묶기·삭제 버튼이 나타나요.</p>
      <p>그룹으로 묶은 뒤엔 멤버 중 아무거나 하나만 드래그해도 전부 같이 움직여요.</p>
      <p>풀고 싶으면 Shift+드래그로 묶인 것들을 선택한 뒤 그룹 해제 버튼을 누르세요.</p>
    </div>
  );

  const searchInput = (
    <input
      type="text"
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      placeholder="컴포넌트 검색..."
      className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
    />
  );

  if (mode === "collapsed") {
    return (
      <div className="group relative w-5 shrink-0">
        {/* 평소엔 이 얇은 띠만 보인다 — 캔버스 레이아웃 폭은 그대로 유지. */}
        <div className="flex h-full w-5 flex-col items-center border-r border-gray-200 bg-white pt-3 dark:border-gray-700 dark:bg-gray-900">
          <span className="text-base text-gray-400 dark:text-gray-500">›</span>
        </div>
        {/*
          띠에 마우스를 올리면 캔버스 위로 떠서 펼쳐지는 미리보기. 레이아웃 폭을 안 늘리려고 absolute로 띄운다.
          평소엔 왼쪽으로 완전히 숨겨뒀다가(-translate-x-full) 호버하면 오른쪽(-translate-x-0)으로 슬라이드되어
          나온다 — 너무 느리면 답답하다는 피드백이 들어올 수 있어 200ms로 짧게 잡았다.
        */}
        <aside className="invisible absolute left-0 top-0 z-20 flex h-full w-56 -translate-x-full flex-col border-r border-gray-200 bg-white opacity-0 shadow-lg transition-all duration-200 ease-out delay-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-0 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1.5 border-b border-gray-200 p-2 dark:border-gray-700">
            {searchInput}
            <button
              type="button"
              onClick={() => setMode("pinned")}
              title="팔레트 고정하기"
              aria-label="팔레트 고정하기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base text-gray-500 shadow-sm hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
            >
              📌
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {sectionList}
            {tips}
          </div>
        </aside>
      </div>
    );
  }

  return (
    // 고정된 상태일 땐 z-30을 줘서, 옆에 접혀 있는 다른 패널의 호버 미리보기(z-20)가 위로 덮지 못하게 한다.
    <aside
      className="relative z-30 flex shrink-0 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
      style={{ width }}
    >
      <ResizeHandle edge="right" onPointerDown={handlePointerDown} />
      <div className="flex items-center gap-1.5 border-b border-gray-200 p-2 dark:border-gray-700">
        {searchInput}
        <button
          type="button"
          onClick={() => setMode("collapsed")}
          title="컴포넌트 팔레트 접기"
          aria-label="컴포넌트 팔레트 접기"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base text-gray-500 shadow-sm hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
        >
          ‹
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {sectionList}
        {tips}
      </div>
    </aside>
  );
}
