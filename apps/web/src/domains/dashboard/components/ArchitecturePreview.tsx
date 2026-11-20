import type { ArchitectureGraph, ComponentType } from "@nangman/shared-types";
import type { ComponentCategory } from "../../architecture-canvas/component-meta";
import { COMPONENT_META } from "../../architecture-canvas/component-meta";
import { getAbsolutePosition, getNodeSize } from "../../architecture-canvas/containment";
import { graphToFlow } from "../../architecture-canvas/types";

const PREVIEW_PADDING = 24;

/** 자주 쓰는 "핵심 인프라" 타입은 역할별로 눈에 띄게 구분하고, 나머지는 카테고리 단위로 색을 묶는다. */
const TYPE_COLOR: Partial<Record<ComponentType, string>> = {
  USER: "#94a3b8",
  LOAD_BALANCER: "#a78bfa",
  WEB_SERVER: "#fb923c",
  AUTO_SCALING_GROUP: "#fb923c",
  DB_PRIMARY: "#f472b6",
  DB_REPLICA: "#f472b6",
  CACHE: "#22d3ee",
  CDN: "#60a5fa",
};

const CATEGORY_COLOR: Record<ComponentCategory, string> = {
  "핵심 인프라": "#5aff9e",
  네트워킹: "#818cf8",
  "엣지/보안": "#f87171",
  "컴퓨트/메시징": "#fb923c",
  "네트워크 경계": "#5aff9e",
  "데이터/스트리밍": "#f472b6",
  "CI/CD": "#2dd4bf",
  "컨테이너/AI·ML": "#c084fc",
  주석: "#9ca3af",
};

function colorForType(type: ComponentType): string {
  return TYPE_COLOR[type] ?? CATEGORY_COLOR[COMPONENT_META[type].category];
}

/**
 * 대시보드 카드의 캔버스 미리보기 — 실제 캔버스를 그대로 캡처하는 대신(각 카드마다 React Flow를
 * 띄워야 해서 목록 화면에 너무 무겁다), 저장된 그래프의 노드 위치·크기·연결선만으로 가벼운 SVG
 * 축소판을 그린다. 그룹(VPC/Subnet 등)은 점선 테두리만, 리프 노드(EC2/RDS 등)는 타입별로 색을
 * 다르게 채운 사각형으로 구분한다.
 */
export function ArchitecturePreview({ graph }: { graph: ArchitectureGraph }) {
  const { nodes, edges } = graphToFlow(graph);

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-jetbrains text-[11px] font-semibold text-console-muted">
        빈 캔버스
      </div>
    );
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const boxes = nodes.map((node) => {
    const abs = getAbsolutePosition(node, nodesById);
    const size = getNodeSize(node);
    return { node, minX: abs.x, minY: abs.y, maxX: abs.x + size.width, maxY: abs.y + size.height };
  });
  const boxById = new Map(boxes.map((box) => [box.node.id, box]));

  const minX = Math.min(...boxes.map((box) => box.minX)) - PREVIEW_PADDING;
  const minY = Math.min(...boxes.map((box) => box.minY)) - PREVIEW_PADDING;
  const maxX = Math.max(...boxes.map((box) => box.maxX)) + PREVIEW_PADDING;
  const maxY = Math.max(...boxes.map((box) => box.maxY)) + PREVIEW_PADDING;
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  // 그룹(컨테이너)을 먼저 그려서 배경 역할을 하게 하고, 리프 노드가 그 위에 덮이지 않게 한다.
  const sortedBoxes = [...boxes].sort((a, b) => {
    const aIsGroup = COMPONENT_META[a.node.type].isGroup ? 0 : 1;
    const bIsGroup = COMPONENT_META[b.node.type].isGroup ? 0 : 1;
    return aIsGroup - bIsGroup;
  });

  return (
    <svg viewBox={`${minX} ${minY} ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {/* 연결선을 가장 먼저 그려서 노드 박스 아래로 지나가게 한다. */}
      {edges.map((edge) => {
        const source = boxById.get(edge.source);
        const target = boxById.get(edge.target);
        if (!source || !target) return null;
        const x1 = (source.minX + source.maxX) / 2;
        const y1 = (source.minY + source.maxY) / 2;
        const x2 = (target.minX + target.maxX) / 2;
        const y2 = (target.minY + target.maxY) / 2;
        return <line key={edge.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(148,163,184,.4)" strokeWidth={1.5} />;
      })}
      {sortedBoxes.map(({ node, minX: x, minY: y, maxX: x2, maxY: y2 }) => {
        const isGroup = COMPONENT_META[node.type].isGroup;
        return isGroup ? (
          <rect
            key={node.id}
            x={x}
            y={y}
            width={x2 - x}
            height={y2 - y}
            rx={6}
            fill="none"
            stroke="rgba(90,255,158,.35)"
            strokeWidth={2}
            strokeDasharray="6 5"
          />
        ) : (
          <rect key={node.id} x={x} y={y} width={x2 - x} height={y2 - y} rx={4} fill={colorForType(node.type)} />
        );
      })}
    </svg>
  );
}
