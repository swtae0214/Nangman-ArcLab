import { NodeResizer, useReactFlow, type NodeProps } from "@xyflow/react";
import { COMPONENT_META, NESTED_GROUP_MIN_HEIGHT, NESTED_GROUP_MIN_WIDTH, NESTING_BORDER_COLORS } from "../../component-meta";
import { resolveContainment } from "../../containment";
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
 *
 * 12단계: 리사이즈 중에는 자식들을 일부러 안 건드린다 — @xyflow/react의 NodeResizer가 "부모가
 * top/left 핸들로 위치까지 바뀌는 리사이즈를 할 때, 자식의 상대좌표를 자동 보정해서 화면상
 * 절대 위치를 그대로 유지시키는" 동작을 라이브러리 차원에서 이미 갖고 있다. 이 보정은 리사이즈가
 * 시작되는 그 순간(d3-drag의 네이티브 'start' 이벤트) 자식 목록을 내부적으로 캐시해두고 매 프레임
 * 적용하는데, 이게 React의 onResizeStart 콜백보다 먼저 실행된다. 그래서 여기서 드래그처럼
 * "시작할 때 소속을 떼어놓는" 걸 하면, 라이브러리는 이미 캐시해둔 옛 자식 목록으로 계속 보정값을
 * 밀어넣고, 그 값이 소속이 없어진 상태라 절대좌표로 잘못 해석되면서 자식들이 화면 밖으로 튕겨
 * 나가는 버그가 났다(실제로 겪음). 라이브러리의 기본 보정이 이미 "리사이즈해도 내용물이 화면에서
 * 안 움직인다"를 제공하므로, 그걸 그대로 믿고 리사이즈가 끝난 뒤(onResizeEnd)에만
 * resolveContainment로 최종 소속을 다시 계산한다.
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
