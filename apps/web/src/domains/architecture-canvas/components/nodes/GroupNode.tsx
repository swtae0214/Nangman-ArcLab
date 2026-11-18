import { NodeResizer, useReactFlow, type NodeProps } from "@xyflow/react";
import { COMPONENT_META, NESTED_GROUP_MIN_HEIGHT, NESTED_GROUP_MIN_WIDTH, NESTING_BORDER_COLORS } from "../../component-meta";
import { detachDirectChildren, resolveContainment } from "../../containment";
import { useProblemNodeIds } from "../../problem-nodes-context";
import { useIsReadOnly } from "../../read-only-context";
import type { FlowNode } from "../../types";
import { EditableLabel } from "../EditableLabel";
import { NodeDeleteButton } from "../NodeDeleteButton";

/**
 * 컨테이너 컴포넌트들(ASG/Multi-AZ/Multi-Region/Region/VPC/Subnet 등)이 공유하는 렌더러.
 * 다른 노드를 이 영역 안으로 드롭하면 parentId가 이 노드로 설정된다 (ArchitectureCanvas 참고).
 * 삭제(×)하면 이 컨테이너만 사라지고, 안에 있던 노드들은 소속만 풀린 채 그 자리에 남는다
 * (NodeDeleteButton 참고).
 * 9단계: Region>AZ>VPC>Subnet처럼 여러 겹으로 중첩할 때 안에 더 넣을 자리가 필요해서, 모서리를
 * 끌어 직접 크기를 늘릴 수 있게 NodeResizer를 달았다(읽기 전용 화면에서는 숨김).
 * 중첩된 그룹들이 전부 같은 색이면 어디가 어느 박스인지 구분이 안 돼서, parentId 체인을 따라
 * 올라가며 중첩 깊이를 구하고 그 깊이에 맞는 테두리 색을 순환시켜 칠한다.
 */
export function GroupNode({ id, type, data, selected }: NodeProps<FlowNode>) {
  const meta = COMPONENT_META[type];
  const Icon = meta.Icon;
  const { setNodes, getNode } = useReactFlow<FlowNode>();
  const hasProblem = useProblemNodeIds().has(id);
  const isReadOnly = useIsReadOnly();

  const handleLabelChange = (label: string) => {
    setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)));
  };

  let depth = 0;
  let ancestor = getNode(id);
  while (ancestor?.parentId) {
    depth += 1;
    ancestor = getNode(ancestor.parentId);
  }
  const borderColor = NESTING_BORDER_COLORS[depth % NESTING_BORDER_COLORS.length];

  return (
    <div
      className={`relative h-full w-full rounded-xl border-2 border-dashed bg-gray-50/50 dark:bg-gray-800/50 ${
        hasProblem ? "border-red-500 dark:border-red-500" : borderColor
      }`}
    >
      <NodeResizer
        isVisible={!isReadOnly && selected}
        minWidth={NESTED_GROUP_MIN_WIDTH}
        minHeight={NESTED_GROUP_MIN_HEIGHT}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded !border !border-blue-400 !bg-white dark:!bg-gray-800"
        // 12단계: 리사이즈를 시작하면 지금 들어 있던 자식들을 먼저 절대좌표로 떼어놓는다(드래그와
        // 동일한 이유 — 크기가 바뀌는 도중에 안 끌려다니게). 리사이즈가 끝나면 resolveContainment가
        // 그 최종 크기/위치에 걸리는 것만 다시 소속시킨다.
        onResizeStart={() => setNodes((nds) => detachDirectChildren(nds, id))}
        onResizeEnd={() => setNodes((nds) => resolveContainment(nds))}
      />
      {!isReadOnly && <NodeDeleteButton nodeId={id} />}
      <div className="flex items-center gap-1.5 px-2 py-1">
        <Icon size={20} />
        {isReadOnly ? (
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">{data.label}</span>
        ) : (
          <EditableLabel
            value={data.label}
            onChange={handleLabelChange}
            className="text-xs font-semibold text-gray-700 dark:text-gray-200"
          />
        )}
      </div>
    </div>
  );
}
