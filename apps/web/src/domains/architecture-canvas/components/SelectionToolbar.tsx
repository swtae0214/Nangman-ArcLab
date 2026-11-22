"use client";

import type { ComponentType } from "@nangman/shared-types";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { getAbsolutePosition, getNodeSize } from "../containment";
import type { FlowEdge, FlowNode } from "../types";

/** 상단 바와 경쟁하지 않도록, 선택한 노드/엣지 바로 위(또는 공간이 없으면 아래)에 띄우는 플로팅 툴바. */
const TOOLBAR_GAP_PX = 10;
/** 이 값보다 선택 영역 위쪽 여백이 좁으면, 툴바를 위가 아니라 아래로 뒤집어서 띄운다. */
const MIN_TOP_SPACE_PX = 80;
const SCREEN_EDGE_MARGIN_PX = 8;
/** 좌표가 이 값보다 적게 바뀌면 리렌더를 건너뛴다 — 매 프레임 추적하면서도 불필요한 렌더는 줄인다. */
const POSITION_EPSILON_PX = 0.5;

const TRANSFORM_PATTERN = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)\s*scale\(([-\d.]+)\)/;

/**
 * "이 선택에 추천" 묶기 옵션을 정하는 규칙. 선택된 리소스 타입을 보고, 실무에서 그 타입과
 * 자주 같이 쓰이는 묶기 종류를 제안한다 — 예: 웹 서버/로드밸런서를 고르면 ASG·Target Group을,
 * DB/캐시를 고르면 Multi-AZ 그룹을 추천한다. 여기 없는 타입은 추천 없이 카테고리에서 직접 찾는다.
 */
const GROUP_RECOMMENDATION_RULES: Partial<Record<ComponentType, ComponentType[]>> = {
  WEB_SERVER: ["AUTO_SCALING_GROUP", "TARGET_GROUP"],
  LOAD_BALANCER: ["TARGET_GROUP"],
  DB_PRIMARY: ["MULTI_AZ_GROUP"],
  DB_REPLICA: ["MULTI_AZ_GROUP"],
  CACHE: ["MULTI_AZ_GROUP"],
  // 12단계: ASG-001/MULTIAZ-001이 늘어난 타입만큼 "추천" 묶기도 같이 늘렸다 — ECS/Elastic
  // Beanstalk는 실제로 EC2 Auto Scaling Group을 쓰는 서비스고, Redshift/OpenSearch는 RDS처럼
  // Multi-AZ를 직접 켤 수 있는 서비스라 추천에 넣었다.
  ECS: ["AUTO_SCALING_GROUP"],
  ELASTIC_BEANSTALK: ["AUTO_SCALING_GROUP"],
  // Fargate는 EC2 ASG가 아니라 ECS 서비스로 이중화한다(실제 AWS 동작 방식 차이).
  FARGATE: ["ECS_SERVICE"],
  REDSHIFT: ["MULTI_AZ_GROUP"],
  OPENSEARCH: ["MULTI_AZ_GROUP"],
  API_GATEWAY: ["TARGET_GROUP"],
};

/** 묶기 팝오버 안에서 보여줄 카테고리 분류 — 종류가 늘어도 한눈에 찾기 쉽게 묶어둔다. */
const GROUP_CATEGORY_ORDER = ["AWS 구조", "다중화", "로드밸런싱", "기타"] as const;
type GroupCategory = (typeof GROUP_CATEGORY_ORDER)[number];
const GROUP_CATEGORY_BY_TYPE: Partial<Record<ComponentType, GroupCategory>> = {
  AWS_CLOUD: "AWS 구조",
  REGION: "AWS 구조",
  VPC: "AWS 구조",
  AVAILABILITY_ZONE: "AWS 구조",
  PUBLIC_SUBNET: "AWS 구조",
  PRIVATE_SUBNET: "AWS 구조",
  MULTI_AZ_GROUP: "다중화",
  MULTI_REGION_GROUP: "다중화",
  TARGET_GROUP: "로드밸런싱",
  AUTO_SCALING_GROUP: "로드밸런싱",
  ECS_SERVICE: "로드밸런싱",
  GENERIC_GROUP: "기타",
  CORPORATE_DATACENTER: "기타",
};

interface SelectionToolbarProps {
  /** 왼쪽 컴포넌트 패널 등 캔버스 바깥으로 넘어가지 않도록, 이 영역의 화면 경계 안으로 위치를 clamp한다. */
  boundsRef: RefObject<HTMLElement | null>;
  nodes: readonly FlowNode[];
  selectedNodes: readonly FlowNode[];
  selectedEdges: readonly FlowEdge[];
  groupableSelectedNodes: readonly FlowNode[];
  logicalGroupableSelectedNodes: readonly FlowNode[];
  groupableTypes: readonly { type: ComponentType; label: string }[];
  logicalGroupableTypes: readonly { type: ComponentType; label: string }[];
  hasZOrderSelection: boolean;
  hasUngroupSelection: boolean;
  onGroup: (type: ComponentType) => void;
  onCreateLogicalGroup: (type: ComponentType) => void;
  onShiftZOrder: (delta: number) => void;
  onUngroup: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
}

interface FlowBounds {
  centerX: number;
  minY: number;
  maxY: number;
}

/** 선택된 노드/엣지가 걸쳐 있는 전체 영역을 플로우 좌표(팬/줌 반영 전)로 계산한다. */
function getSelectionFlowBounds(
  nodes: readonly FlowNode[],
  selectedNodes: readonly FlowNode[],
  selectedEdges: readonly FlowEdge[],
): FlowBounds | null {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const anchorNodeIds = new Set(selectedNodes.map((node) => node.id));
  for (const edge of selectedEdges) {
    anchorNodeIds.add(edge.source);
    anchorNodeIds.add(edge.target);
  }
  const anchorNodes = [...anchorNodeIds].map((id) => nodesById.get(id)).filter((node): node is FlowNode => !!node);
  if (anchorNodes.length === 0) return null;

  const boxes = anchorNodes.map((node) => {
    const abs = getAbsolutePosition(node, nodesById);
    const size = getNodeSize(node);
    return { minX: abs.x, minY: abs.y, maxX: abs.x + size.width, maxY: abs.y + size.height };
  });
  const minX = Math.min(...boxes.map((box) => box.minX));
  const minY = Math.min(...boxes.map((box) => box.minY));
  const maxX = Math.max(...boxes.map((box) => box.maxX));
  const maxY = Math.max(...boxes.map((box) => box.maxY));
  return { centerX: (minX + maxX) / 2, minY, maxY };
}

/**
 * React Flow의 뷰포트(팬/줌) 변환을 zustand 스토어가 아니라 실제 DOM에서 직접 읽는다.
 * 팬 중에는 `.react-flow__viewport`의 CSS transform이 d3-zoom에 의해 화면마다 바로 갱신되는데,
 * 라이브러리가 노출하는 flowToScreenPosition/useViewport는 내부 스토어 값을 쓰고, 그 값은 드래그
 * 도중에는 갱신되지 않고 제스처가 끝나야 반영된다(실제로 겪음 — 선택 툴바가 팬 중엔 안 따라왔다).
 * 그래서 화면에 실제로 그려지는 값을 직접 읽어, 느리더라도 항상 맞게 맞춘다.
 */
function readLiveTransform(container: HTMLElement): { x: number; y: number; zoom: number } | null {
  const viewportEl = container.querySelector<HTMLElement>(".react-flow__viewport");
  if (!viewportEl) return null;
  const match = TRANSFORM_PATTERN.exec(viewportEl.style.transform);
  if (!match) return null;
  return { x: parseFloat(match[1]), y: parseFloat(match[2]), zoom: parseFloat(match[3]) };
}

interface ToolbarStyle {
  left: number;
  top: number;
  placement: "above" | "below";
}

interface PopoverStyle {
  left: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

/**
 * 팝오버(묶기/더보기)가 뷰포트 위·아래로 넘치지 않게, 트리거 버튼 기준으로 공간이 더 넓은
 * 쪽에 열고 그 공간만큼만 높이를 준다. 드래그·팬 중에도 같이 따라가도록 매 렌더마다 다시 잰다
 * (팝오버가 열려 있을 때만 도는 가벼운 계산이라 비용은 작다).
 */
function usePopoverPlacement(
  isOpen: boolean,
  buttonRef: RefObject<HTMLElement | null>,
  boundsRef: RefObject<HTMLElement | null>,
  popoverWidthPx: number,
  /** 툴바가 드래그/팬 중 움직일 때마다 바뀌는 값 — 이게 바뀔 때도 팝오버 위치를 다시 잰다. */
  trackValue: unknown,
) {
  const [popoverStyle, setPopoverStyle] = useState<PopoverStyle | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const buttonRect = buttonRef.current?.getBoundingClientRect();
    if (!buttonRect) return;
    const boundsRect = boundsRef.current?.getBoundingClientRect();

    const spaceAbove = buttonRect.top - SCREEN_EDGE_MARGIN_PX;
    const spaceBelow = window.innerHeight - buttonRect.bottom - SCREEN_EDGE_MARGIN_PX;
    const openAbove = spaceAbove >= spaceBelow;

    const minLeft = (boundsRect?.left ?? 0) + SCREEN_EDGE_MARGIN_PX;
    const maxLeft = (boundsRect?.right ?? window.innerWidth) - popoverWidthPx - SCREEN_EDGE_MARGIN_PX;
    const left = Math.min(Math.max(buttonRect.left, minLeft), Math.max(minLeft, maxLeft));

    setPopoverStyle(
      openAbove
        ? { left, bottom: window.innerHeight - buttonRect.top + 6, maxHeight: Math.max(120, spaceAbove - 6) }
        : { left, top: buttonRect.bottom + 6, maxHeight: Math.max(120, spaceBelow - 6) },
    );
  }, [isOpen, buttonRef, boundsRef, popoverWidthPx, trackValue]);

  return isOpen ? popoverStyle : null;
}

interface GroupOption {
  type: ComponentType;
  label: string;
  onClick: () => void;
  variant: "default" | "danger";
}

const ICON_BUTTON_CLASS =
  "flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700";

function CopyIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="8" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 16V4h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9 15v4a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

export function SelectionToolbar({
  boundsRef,
  nodes,
  selectedNodes,
  selectedEdges,
  groupableSelectedNodes,
  logicalGroupableSelectedNodes,
  groupableTypes,
  logicalGroupableTypes,
  hasZOrderSelection,
  hasUngroupSelection,
  onGroup,
  onCreateLogicalGroup,
  onShiftZOrder,
  onUngroup,
  onDelete,
  onCopy,
  onDuplicate,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<ToolbarStyle | null>(null);
  const lastStyleRef = useRef<ToolbarStyle | null>(null);
  const [isGroupMenuOpen, setGroupMenuOpen] = useState(false);
  const [isMoreMenuOpen, setMoreMenuOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const groupMenuContainerRef = useRef<HTMLDivElement>(null);
  const moreMenuContainerRef = useRef<HTMLDivElement>(null);
  const groupButtonRef = useRef<HTMLButtonElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const groupPopoverStyle = usePopoverPlacement(isGroupMenuOpen, groupButtonRef, boundsRef, 320, style);
  const morePopoverStyle = usePopoverPlacement(isMoreMenuOpen, moreButtonRef, boundsRef, 160, style);

  const flowBounds = getSelectionFlowBounds(nodes, selectedNodes, selectedEdges);
  const { centerX, minY, maxY } = flowBounds ?? {};

  // 선택이 바뀌면(다른 노드를 고르면) 열려 있던 메뉴는 다시 접어서 시작한다.
  const selectionSignature = [...selectedNodes.map((node) => node.id), ...selectedEdges.map((edge) => edge.id)]
    .sort()
    .join(",");
  const [prevSignature, setPrevSignature] = useState(selectionSignature);
  if (prevSignature !== selectionSignature) {
    setPrevSignature(selectionSignature);
    if (isGroupMenuOpen) setGroupMenuOpen(false);
    if (isMoreMenuOpen) setMoreMenuOpen(false);
    if (groupSearch) setGroupSearch("");
  }

  const groupOptions = useMemo<GroupOption[]>(
    () => [
      ...(groupableSelectedNodes.length > 0
        ? groupableTypes.map(({ type, label }) => ({ type, label, onClick: () => onGroup(type), variant: "default" as const }))
        : []),
      ...(logicalGroupableSelectedNodes.length > 0
        ? logicalGroupableTypes.map(({ type, label }) => ({
            type,
            label,
            onClick: () => onCreateLogicalGroup(type),
            variant: "danger" as const,
          }))
        : []),
    ],
    [groupableSelectedNodes.length, logicalGroupableSelectedNodes.length, groupableTypes, logicalGroupableTypes, onGroup, onCreateLogicalGroup],
  );

  const recommendedTypes = useMemo(() => {
    const available = new Set(groupOptions.map((option) => option.type));
    const recommended = new Set<ComponentType>();
    for (const node of selectedNodes) {
      for (const type of GROUP_RECOMMENDATION_RULES[node.type] ?? []) {
        if (available.has(type)) recommended.add(type);
      }
    }
    return recommended;
  }, [selectedNodes, groupOptions]);

  const query = groupSearch.trim().toLowerCase();
  const matchesQuery = (option: GroupOption) => query === "" || option.label.toLowerCase().includes(query);

  const recommendedOptions = groupOptions.filter((option) => recommendedTypes.has(option.type) && matchesQuery(option));
  const categorizedOptions = GROUP_CATEGORY_ORDER.map((category) => ({
    category,
    options: groupOptions.filter((option) => GROUP_CATEGORY_BY_TYPE[option.type] === category && matchesQuery(option)),
  })).filter(({ options }) => options.length > 0);

  const hasAnyGroupResult = recommendedOptions.length > 0 || categorizedOptions.length > 0;

  // 메뉴 바깥을 클릭하면 닫는다.
  useEffect(() => {
    if (!isGroupMenuOpen && !isMoreMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (groupMenuContainerRef.current?.contains(target) || moreMenuContainerRef.current?.contains(target)) return;
      setGroupMenuOpen(false);
      setMoreMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isGroupMenuOpen, isMoreMenuOpen]);

  // 선택이 떠 있는 동안 매 프레임 위치를 다시 계산한다 — 팬/줌/드래그 어느 쪽이든 선택을 계속 따라간다.
  useEffect(() => {
    if (centerX === undefined || minY === undefined || maxY === undefined) {
      // 선택이 비면 아래 return null로 컴포넌트 자체가 사라지므로, state를 따로 되돌릴 필요는 없다.
      lastStyleRef.current = null;
      return;
    }

    let rafId: number;
    const tick = () => {
      const container = boundsRef.current;
      const toolbarEl = toolbarRef.current;
      const transform = container ? readLiveTransform(container) : null;
      if (container && toolbarEl && transform) {
        const containerRect = container.getBoundingClientRect();
        const topScreenX = containerRect.left + transform.x + centerX * transform.zoom;
        const topScreenY = containerRect.top + transform.y + minY * transform.zoom;
        const bottomScreenY = containerRect.top + transform.y + maxY * transform.zoom;

        const { width, height } = toolbarEl.getBoundingClientRect();
        const minLeft = containerRect.left + SCREEN_EDGE_MARGIN_PX;
        const maxLeft = containerRect.right - width - SCREEN_EDGE_MARGIN_PX;
        const placement: "above" | "below" = topScreenY - height - TOOLBAR_GAP_PX < MIN_TOP_SPACE_PX ? "below" : "above";
        const rawLeft = topScreenX - width / 2;
        const left = Math.min(Math.max(rawLeft, minLeft), Math.max(minLeft, maxLeft));
        const top = placement === "above" ? topScreenY - height - TOOLBAR_GAP_PX : bottomScreenY + TOOLBAR_GAP_PX;

        const prev = lastStyleRef.current;
        if (
          !prev ||
          Math.abs(prev.left - left) > POSITION_EPSILON_PX ||
          Math.abs(prev.top - top) > POSITION_EPSILON_PX ||
          prev.placement !== placement
        ) {
          const next = { left, top, placement };
          lastStyleRef.current = next;
          setStyle(next);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [centerX, minY, maxY, boundsRef]);

  if (!flowBounds) return null;

  const selectionCount = selectedNodes.length + selectedEdges.length;

  return (
    <div
      ref={toolbarRef}
      data-testid="selection-toolbar"
      style={{
        position: "fixed",
        left: style?.left ?? -9999,
        top: style?.top ?? -9999,
        visibility: style ? "visible" : "hidden",
      }}
      className="z-50 flex items-center gap-1 rounded-lg border border-gray-300 bg-white p-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-800"
    >
      <span className="px-1.5 text-xs text-gray-500 dark:text-gray-400">{selectionCount}개 선택</span>

      {groupOptions.length > 0 && (
        <div ref={groupMenuContainerRef} className="relative">
          <button
            ref={groupButtonRef}
            type="button"
            onClick={() => {
              setMoreMenuOpen(false);
              setGroupMenuOpen((open) => !open);
            }}
            className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs shadow-sm hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            묶기 <ChevronIcon open={isGroupMenuOpen} />
          </button>

          {isGroupMenuOpen && groupPopoverStyle && (
            <div
              style={{
                position: "fixed",
                left: groupPopoverStyle.left,
                top: groupPopoverStyle.top,
                bottom: groupPopoverStyle.bottom,
                maxHeight: groupPopoverStyle.maxHeight,
              }}
              className="w-80 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              <input
                type="text"
                value={groupSearch}
                onChange={(event) => setGroupSearch(event.target.value)}
                placeholder="그룹 종류 검색 (예: VPC, Subnet)"
                className="mb-3 w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
                autoFocus
              />

              {!hasAnyGroupResult && <p className="py-4 text-center text-xs text-gray-400">일치하는 묶기 종류가 없어요.</p>}

              {recommendedOptions.length > 0 && (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">이 선택에 추천</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {recommendedOptions.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => {
                          option.onClick();
                          setGroupMenuOpen(false);
                        }}
                        className="rounded-md border border-blue-300 bg-blue-50 px-2 py-1.5 text-left text-xs text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {categorizedOptions.map(({ category, options }) => (
                <div key={category} className="mb-3 last:mb-0">
                  <p className="mb-1.5 text-[11px] font-medium text-gray-400 dark:text-gray-500">{category}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {options.map((option) => (
                      <button
                        key={option.type}
                        type="button"
                        onClick={() => {
                          option.onClick();
                          setGroupMenuOpen(false);
                        }}
                        className={
                          option.variant === "danger"
                            ? "rounded-md border border-red-200 bg-white px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:bg-gray-900 dark:text-red-400 dark:hover:bg-red-950"
                            : "rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                        }
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />

      <button type="button" onClick={onCopy} title="복사 (Ctrl+C)" aria-label="복사" className={ICON_BUTTON_CLASS}>
        <CopyIcon />
      </button>
      <button type="button" onClick={onDuplicate} title="복제" aria-label="복제" className={ICON_BUTTON_CLASS}>
        <DuplicateIcon />
      </button>

      {(hasZOrderSelection || hasUngroupSelection) && (
        <div ref={moreMenuContainerRef} className="relative">
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => {
              setGroupMenuOpen(false);
              setMoreMenuOpen((open) => !open);
            }}
            title="더 보기"
            aria-label="더 보기"
            className={ICON_BUTTON_CLASS}
          >
            <MoreIcon />
          </button>
          {isMoreMenuOpen && morePopoverStyle && (
            <div
              style={{
                position: "fixed",
                left: morePopoverStyle.left,
                top: morePopoverStyle.top,
                bottom: morePopoverStyle.bottom,
                maxHeight: morePopoverStyle.maxHeight,
              }}
              className="flex w-40 flex-col gap-0.5 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            >
              {hasZOrderSelection && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onShiftZOrder(1);
                      setMoreMenuOpen(false);
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    앞으로 가져오기
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onShiftZOrder(-1);
                      setMoreMenuOpen(false);
                    }}
                    className="rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    뒤로 보내기
                  </button>
                </>
              )}
              {hasUngroupSelection && (
                <button
                  type="button"
                  onClick={() => {
                    onUngroup();
                    setMoreMenuOpen(false);
                  }}
                  className="rounded-md px-2 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  그룹 해제
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onDelete}
        title="삭제"
        aria-label="삭제"
        className={`${ICON_BUTTON_CLASS} hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400`}
      >
        <TrashIcon />
      </button>
    </div>
  );
}
