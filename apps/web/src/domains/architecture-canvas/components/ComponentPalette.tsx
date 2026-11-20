"use client";

import type { ComponentType } from "@nangman/shared-types";
import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { COMPONENT_META, COMPONENT_PALETTE_SECTIONS, type ComponentCategory } from "../component-meta";

export const COMPONENT_DRAG_DATA_FORMAT = "application/x-nangman-component-type";

/** 이 폭(px) 이상이면 2열 카드 그리드, 미만이면 1열 리스트로 자동 전환한다. */
const CARD_GRID_MIN_WIDTH = 260;

/** "웹 서버 (EC2)" 같은 라벨을 카드형일 때 이름/타입 두 줄로 나눠 보여주기 위해 쪼갠다. */
function splitLabel(label: string): { name: string; subtitle?: string } {
  const match = /^(.+) \(([^()]+)\)$/.exec(label);
  if (!match) return { name: label };
  return { name: match[1], subtitle: match[2] };
}

interface ComponentPaletteContentProps {
  /** 현재 패널 폭(px) — 이 값으로 1열/2열을 자동으로 고른다. */
  width: number;
}

/** 사이드바의 드래그 소스. ArchitectureCanvas의 onDrop이 이 dataTransfer 값을 읽는다. */
export function ComponentPaletteContent({ width }: ComponentPaletteContentProps) {
  const [query, setQuery] = useState("");
  const isCardGrid = width >= CARD_GRID_MIN_WIDTH;
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

  const renderButton = (type: ComponentType) => {
    const meta = COMPONENT_META[type];
    const Icon = meta.Icon;
    if (!isCardGrid) {
      return (
        <button
          key={type}
          type="button"
          draggable
          onDragStart={(event) => handleDragStart(event, type)}
          data-tutorial-id={`palette-component-${type}`}
          className="flex cursor-grab items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left text-sm shadow-sm hover:bg-gray-50 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
        >
          <Icon size={24} />
          <span>{meta.label}</span>
        </button>
      );
    }
    const { name, subtitle } = splitLabel(meta.label);
    return (
      <button
        key={type}
        type="button"
        draggable
        onDragStart={(event) => handleDragStart(event, type)}
        data-tutorial-id={`palette-component-${type}`}
        className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-2 text-center shadow-sm hover:bg-gray-50 active:cursor-grabbing dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
      >
        <Icon size={24} />
        <span className="text-xs font-semibold">{name}</span>
        {subtitle && <span className="text-[10px] text-gray-400 dark:text-gray-500">{subtitle}</span>}
      </button>
    );
  };

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
              {category} · {types.length}
            </button>
            {!isCollapsed && (
              <div className={isCardGrid ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
                {types.map((type) => renderButton(type))}
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
      <p>Shift+드래그로 영역을 선택하면 떠 있는 툴바에서 묶기·삭제를 할 수 있어요.</p>
      <p>그룹으로 묶은 뒤엔 멤버 중 아무거나 하나만 드래그해도 전부 같이 움직여요.</p>
      <p>풀고 싶으면 Shift+드래그로 묶인 것들을 선택한 뒤 그룹 해제 버튼을 누르세요.</p>
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 p-2 dark:border-gray-700">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="컴포넌트 검색..."
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {sectionList}
        {tips}
      </div>
    </div>
  );
}
