import { useReactFlow, type NodeProps } from "@xyflow/react";
import { COMPONENT_META, DEFAULT_LOGICAL_GROUP_BORDER_COLOR, LOGICAL_GROUP_BORDER_COLOR } from "../../component-meta";
import { useIsReadOnly } from "../../read-only-context";
import type { FlowNode } from "../../types";
import { EditableLabel } from "../EditableLabel";
import { NodeDeleteButton } from "../NodeDeleteButton";

/**
 * "논리적 그룹"(Target Group, Auto Scaling Group) 전용 렌더러.
 * 물리적 그룹(GroupNode)과 달리:
 * - 이 노드의 위치/크기는 사용자가 정하는 게 아니라 ArchitectureCanvas가 멤버 노드들의 실제
 *   위치를 보고 매번 다시 계산한다(logicalGroupId 기준) — 그래서 드래그/리사이즈를 안 붙였다.
 * - 테두리 안쪽은 다른 물리적 컨테이너(서브넷 등) 위에 겹쳐 그려지므로, 안을 클릭했을 때 밑에 있는
 *   진짜 컴포넌트를 여전히 클릭할 수 있도록 바깥 영역은 pointer-events를 꺼두고, 왼쪽 위
 *   이름표 칩만 클릭 가능하게(pointer-events-auto) 열어둔다.
 */
export function LogicalGroupNode({ id, type, data }: NodeProps<FlowNode>) {
  const meta = COMPONENT_META[type];
  const Icon = meta.Icon;
  const borderColor = LOGICAL_GROUP_BORDER_COLOR[type] ?? DEFAULT_LOGICAL_GROUP_BORDER_COLOR;
  const { setNodes } = useReactFlow<FlowNode>();
  const isReadOnly = useIsReadOnly();

  const handleLabelChange = (label: string) => {
    setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)));
  };

  return (
    <div className={`pointer-events-none h-full w-full rounded-xl border-2 ${borderColor}`}>
      <div className="pointer-events-auto absolute -top-3 left-2 flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0.5 pr-5 shadow-sm">
        <Icon size={14} />
        {isReadOnly ? (
          <span className="text-[11px] font-semibold text-gray-700">{data.label}</span>
        ) : (
          <EditableLabel value={data.label} onChange={handleLabelChange} className="text-[11px] font-semibold text-gray-700" />
        )}
        {!isReadOnly && <NodeDeleteButton nodeId={id} />}
      </div>
    </div>
  );
}
