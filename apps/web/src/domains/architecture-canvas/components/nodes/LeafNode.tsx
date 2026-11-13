import type { ComponentType } from "@nangman/shared-types";
import { Handle, NodeResizer, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { COMPONENT_META, LEAF_MIN_HEIGHT, LEAF_MIN_WIDTH } from "../../component-meta";
import { useComponentPresets } from "../../hooks/useCapacityCalculator";
import { useProblemNodeIds } from "../../problem-nodes-context";
import { useIsReadOnly } from "../../read-only-context";
import type { FlowNode } from "../../types";
import { EditableLabel } from "../EditableLabel";
import { NodeDeleteButton } from "../NodeDeleteButton";

/** 5단계 큐잉 엔진이 실제로 M/M/c를 계산하는 타입만 프리셋을 고를 수 있게 한다. */
const PRESET_SELECTABLE_TYPES: ComponentType[] = ["WEB_SERVER", "DB_PRIMARY", "DB_REPLICA", "CACHE"];

/**
 * 리프(비-그룹) 컴포넌트 6종(LB/WebServer/DB Primary·Replica/Cache/CDN)이 공유하는 렌더러.
 * 타입별로 다른 파일을 만들지 않고 COMPONENT_META 표를 조회해 AWS 공식 아이콘만 바꿔 낀다.
 * 아이콘 아래에 더블클릭으로 고칠 수 있는 이름표를, 그 아래에(해당 타입이면) 프리셋 선택을 둔다.
 * 공유 링크로 보는 화면(읽기 전용)에서는 삭제/이름수정/프리셋선택을 전부 숨긴다.
 */
export function LeafNode({ id, type, data, selected }: NodeProps<FlowNode>) {
  const meta = COMPONENT_META[type];
  const Icon = meta.Icon;
  const { setNodes } = useReactFlow<FlowNode>();
  const hasProblem = useProblemNodeIds().has(id);
  const isReadOnly = useIsReadOnly();
  const presetsQuery = useComponentPresets();

  const handleLabelChange = (label: string) => {
    setNodes((nodes) => nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, label } } : node)));
  };

  const handlePresetChange = (presetCode: string) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, presetCode: presetCode === "" ? undefined : presetCode } } : node,
      ),
    );
  };

  const canSelectPreset = PRESET_SELECTABLE_TYPES.includes(type);
  const presetsForType = presetsQuery.data?.filter((preset) => preset.componentType === type) ?? [];
  const currentPresetName = presetsForType.find((preset) => preset.code === data.presetCode)?.displayName;

  return (
    // overflow-hidden은 내용물만 가두는 안쪽 박스에만 건다 — 바깥쪽(이 div)까지 걸면 모서리 밖으로
    // 살짝 튀어나오게 둔 삭제(×) 버튼이 잘려 보인다(실제로 겪은 버그).
    <div className="relative h-full w-full">
      {/* 11단계: "이름 길이에 따라 박스 크기가 제멋대로 변해서 배치가 힘들다"는 피드백으로, 그룹
          노드와 똑같이 직접 리사이즈할 수 있게 했다. 아이콘 크기(36px)는 AWS 공식 아이콘이 가장
          또렷하게 보이는 크기라 박스를 키워도 그대로 두고, 여백/줄바꿈만 늘어난다. */}
      <NodeResizer
        isVisible={!isReadOnly && selected}
        minWidth={LEAF_MIN_WIDTH}
        minHeight={LEAF_MIN_HEIGHT}
        lineClassName="!border-blue-400"
        handleClassName="!h-2.5 !w-2.5 !rounded !border !border-blue-400 !bg-white dark:!bg-gray-800"
      />
      {!isReadOnly && <NodeDeleteButton nodeId={id} />}
      <div
        className={`flex h-full w-full flex-col items-center gap-1 overflow-hidden rounded-lg border bg-white px-3 py-2 shadow-sm dark:bg-gray-800 ${
          hasProblem ? "border-2 border-red-500 dark:border-red-500" : "border-gray-300 dark:border-gray-600"
        }`}
      >
        <Handle type="target" position={Position.Top} />
        <Icon size={36} />
        {isReadOnly ? (
          <span className="line-clamp-2 w-full break-words text-center text-xs font-medium text-gray-800 dark:text-gray-100">
            {data.label}
          </span>
        ) : (
          <EditableLabel
            value={data.label}
            onChange={handleLabelChange}
            className="line-clamp-2 block w-full break-words text-center text-xs font-medium text-gray-800 dark:text-gray-100"
            inputClassName="w-full text-center text-xs dark:bg-gray-700 dark:text-gray-100"
          />
        )}
        {canSelectPreset &&
          (isReadOnly ? (
            currentPresetName && <span className="text-[10px] text-gray-400 dark:text-gray-500">{currentPresetName}</span>
          ) : (
            <select
              className="nodrag w-full rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[10px] text-gray-600 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-300"
              value={data.presetCode ?? ""}
              onChange={(event) => handlePresetChange(event.target.value)}
            >
              <option value="">프리셋 미지정</option>
              {presetsForType.map((preset) => (
                <option key={preset.code} value={preset.code}>
                  {preset.displayName}
                </option>
              ))}
            </select>
          ))}
        <Handle type="source" position={Position.Bottom} />
      </div>
    </div>
  );
}
