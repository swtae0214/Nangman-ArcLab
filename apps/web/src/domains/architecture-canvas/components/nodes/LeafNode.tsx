import type { ComponentType } from "@nangman/shared-types";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { COMPONENT_META } from "../../component-meta";
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
export function LeafNode({ id, type, data }: NodeProps<FlowNode>) {
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
    <div
      className={`relative flex min-w-[110px] flex-col items-center gap-1 rounded-lg border bg-white px-3 py-2 shadow-sm ${
        hasProblem ? "border-2 border-red-500" : "border-gray-300"
      }`}
    >
      {!isReadOnly && <NodeDeleteButton nodeId={id} />}
      <Handle type="target" position={Position.Top} />
      <Icon size={36} />
      {isReadOnly ? (
        <span className="text-center text-xs font-medium text-gray-800">{data.label}</span>
      ) : (
        <EditableLabel
          value={data.label}
          onChange={handleLabelChange}
          className="text-center text-xs font-medium text-gray-800"
          inputClassName="w-full text-center text-xs"
        />
      )}
      {canSelectPreset &&
        (isReadOnly ? (
          currentPresetName && <span className="text-[10px] text-gray-400">{currentPresetName}</span>
        ) : (
          <select
            className="nodrag w-full rounded border border-gray-200 bg-gray-50 px-1 py-0.5 text-[10px] text-gray-600"
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
  );
}
