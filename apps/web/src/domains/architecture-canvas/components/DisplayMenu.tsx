"use client";

import { useEffect, useRef, useState } from "react";
import { ToggleSwitch } from "./ToggleSwitch";

interface DisplayMenuProps {
  showTrafficFlow: boolean;
  onToggleTrafficFlow: () => void;
  showTrafficRps: boolean;
  onToggleTrafficRps: () => void;
  /** true면 전파 엔진이 계산한 RPS 중 0보다 큰 값이 있다 — 꺼져 있을 때만 "켜보라"는 안내를 보여준다. */
  hasRpsToShow: boolean;
  showNodeCost: boolean;
  onToggleNodeCost: () => void;
  /** true면 반영된(= $0보다 큰) 비용이 하나라도 있다. */
  hasCostToShow: boolean;
}

/**
 * B10: 캔버스 좌상단에 토글 3개(트래픽 흐름/RPS/비용)가 세로로 쌓여 있던 걸 "표시" 메뉴 하나로
 * 묶었다. 값을 입력해서 보여줄 게 있는데 토글이 꺼져 있으면, 자동으로 켜는 대신(사용자가 직접
 * 끈 걸 되돌리면 혼란스러워서) 안내 문구로 "켜보라"고만 알려준다.
 */
export function DisplayMenu({
  showTrafficFlow,
  onToggleTrafficFlow,
  showTrafficRps,
  onToggleTrafficRps,
  hasRpsToShow,
  showNodeCost,
  onToggleNodeCost,
  hasCostToShow,
}: DisplayMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const anyOn = showTrafficFlow || showTrafficRps || showNodeCost;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="absolute left-3 top-3 z-20">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        👁 표시
        {anyOn && <span className="h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />}
      </button>
      {isOpen && (
        <div className="mt-1 w-72 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <ToggleSwitch
            variant="inline"
            checked={showTrafficFlow}
            onToggle={onToggleTrafficFlow}
            label="트래픽 흐름 보기"
            title="사용자 요청이 로드밸런서·서버를 거쳐 DB까지 이동하는 구간을 강조해서 보여줘요"
          />
          <ToggleSwitch
            variant="inline"
            checked={showTrafficRps}
            onToggle={onToggleTrafficRps}
            label="트래픽(RPS) 표시"
            title="사용자(USER) 노드의 평균 RPS가 분배·호출선을 타고 각 요소까지 흘러간 값을 노드 아래에 보여줘요"
          />
          {hasRpsToShow && !showTrafficRps && (
            <p className="px-2 pb-1 text-[10px] text-blue-600 dark:text-blue-400">
              💡 표시할 RPS 값이 있어요 — 켜보면 각 노드 아래에 보여요.
            </p>
          )}
          <ToggleSwitch
            variant="inline"
            checked={showNodeCost}
            onToggle={onToggleNodeCost}
            label="비용 보기"
            title="프리셋에 가격 데이터가 있는 노드 아래에 월 예상 비용을 보여줘요"
          />
          {hasCostToShow && !showNodeCost && (
            <p className="px-2 pb-1 text-[10px] text-blue-600 dark:text-blue-400">
              💡 반영된 비용이 있어요 — 켜보면 각 노드 아래에 보여요.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
