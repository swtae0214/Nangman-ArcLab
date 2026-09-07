"use client";

import type { ComponentType } from "@nangman/shared-types";
import type { DragEvent } from "react";
import { COMPONENT_META, COMPONENT_PALETTE_SECTIONS } from "../component-meta";

export const COMPONENT_DRAG_DATA_FORMAT = "application/x-nangman-component-type";

/** 사이드바의 드래그 소스. ArchitectureCanvas의 onDrop이 이 dataTransfer 값을 읽는다. */
export function ComponentPalette() {
  const handleDragStart = (event: DragEvent<HTMLButtonElement>, type: ComponentType) => {
    event.dataTransfer.setData(COMPONENT_DRAG_DATA_FORMAT, type);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <aside className="w-56 shrink-0 overflow-y-auto border-r border-gray-200 p-3">
      {COMPONENT_PALETTE_SECTIONS.map(({ category, types }) => (
        <div key={category} className="mb-4">
          <h2 className="mb-2 text-xs font-semibold uppercase text-gray-500">{category}</h2>
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
                  className="flex cursor-grab items-center gap-2 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-left text-sm shadow-sm hover:bg-gray-50 active:cursor-grabbing"
                >
                  <Icon size={24} />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="space-y-1 text-xs text-gray-400">
        <p>캔버스로 드래그해서 배치하세요.</p>
        <p>더블클릭으로 이름 수정, 노드 위 × 또는 Delete 키로 삭제할 수 있어요.</p>
        <p>Shift+드래그로 영역을 선택하면 오른쪽 위에 묶기·삭제 버튼이 나타나요.</p>
        <p>그룹으로 묶은 뒤엔 멤버 중 아무거나 하나만 드래그해도 전부 같이 움직여요.</p>
        <p>풀고 싶으면 Shift+드래그로 묶인 것들을 선택한 뒤 그룹 해제 버튼을 누르세요.</p>
      </div>
    </aside>
  );
}
