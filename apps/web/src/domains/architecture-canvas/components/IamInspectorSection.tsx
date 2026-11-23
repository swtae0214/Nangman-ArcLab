"use client";

import { COMPONENT_META } from "../component-meta";
import type { SelectedElementInfo } from "../types";

/**
 * 14단계(디자인 검토 반영): IAM 권한의 주체는 역할(IAM 노드) 쪽이라, 편집은 IAM 노드 패널에서만
 * 하고 컴퓨트 노드 패널에서는 상태만 읽기 전용으로 보여준다("역할에서 수정 →" 링크로 역할 노드를
 * 바로 선택할 수 있게 한다). 같은 컴포넌트 안에서 elementInfo.type으로 두 모드를 나눈다.
 */
export function IamInspectorSection({
  elementInfo,
  onUpdateEdgeTraffic,
  onFocusNodes,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateEdgeTraffic: (edgeIds: string[], patch: { iamPermissionGranted?: boolean }) => void;
  onFocusNodes: (nodeIds: string[]) => void;
}) {
  if (elementInfo.type === "IAM") {
    return <IamRoleEditor elementInfo={elementInfo} onUpdateEdgeTraffic={onUpdateEdgeTraffic} />;
  }
  return <IamConnectionsReadOnly elementInfo={elementInfo} onFocusNodes={onFocusNodes} />;
}

/** IAM 노드 패널 — 이 역할을 쓰는 컴퓨트 노드마다 허용/차단을 편집한다(+ 일괄 전환). */
function IamRoleEditor({
  elementInfo,
  onUpdateEdgeTraffic,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateEdgeTraffic: (edgeIds: string[], patch: { iamPermissionGranted?: boolean }) => void;
}) {
  const attachments = elementInfo.iamAttachments ?? [];
  if (attachments.length === 0) return null;

  const grantedCount = attachments.filter((attachment) => attachment.granted).length;
  const allGranted = grantedCount === attachments.length;
  const allBlocked = grantedCount === 0;
  const allEdgeIds = attachments.map((attachment) => attachment.edgeId);

  const masterLabel = allGranted ? `전체 허용 (${attachments.length}/${attachments.length})` : allBlocked ? `전체 차단 (0/${attachments.length})` : `전체 · 일부 허용 (${grantedCount}/${attachments.length})`;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">이 역할을 쓰는 서버 {attachments.length}</p>

      <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
        {/* 디자인 검토: 스위치 하나로는 "일부만 허용" 상태를 표현 못 하니, 상태 문구 + 버튼으로 둔다. */}
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{masterLabel}</span>
        <button
          type="button"
          onClick={() => onUpdateEdgeTraffic(allEdgeIds, { iamPermissionGranted: allGranted ? false : true })}
          className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
        >
          {allGranted ? "모두 차단" : "모두 허용"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.edgeId}
            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-700"
          >
            <span className="truncate text-gray-700 dark:text-gray-200">
              {attachment.computeNodeLabel}
              <span className="ml-1 text-gray-400 dark:text-gray-500">{COMPONENT_META[attachment.computeNodeType].label}</span>
            </span>
            <button
              type="button"
              onClick={() => onUpdateEdgeTraffic([attachment.edgeId], { iamPermissionGranted: !attachment.granted })}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                attachment.granted
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {attachment.granted ? "허용" : "차단"}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        역할은 서버가 S3·DynamoDB·SQS 같은 AWS 서비스를 쓸 수 있는 출입증이에요. 차단하면 트래픽 흐름 보기에서 그 서버의 해당 요청이
        막힌 것으로 표시돼요. (DB 연결은 IAM이 아니라 DB 계정·보안 그룹으로 따로 통제돼요.)
      </p>
    </div>
  );
}

/** 컴퓨트 노드 패널 — 연결된 역할 상태만 읽기 전용으로 보여주고, 수정은 역할 노드로 이동해서 하게 한다. */
function IamConnectionsReadOnly({
  elementInfo,
  onFocusNodes,
}: {
  elementInfo: SelectedElementInfo;
  onFocusNodes: (nodeIds: string[]) => void;
}) {
  const connections = elementInfo.iamConnections ?? [];
  if (connections.length === 0) return null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">IAM 연결 {connections.length}</p>
        <span className="text-[11px] text-gray-400 dark:text-gray-500">읽기 전용</span>
      </div>
      <div className="flex flex-col gap-2">
        {connections.map((connection) => (
          <div key={connection.edgeId} className="rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-700">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-gray-700 dark:text-gray-200">{connection.iamNodeLabel}</span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  connection.granted
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                }`}
              >
                {connection.granted ? "✓ 권한 있음" : "✕ 권한 없음"}
              </span>
            </div>
            {!connection.granted && (
              <p className="mt-1.5 text-gray-500 dark:text-gray-400">
                이 역할에서 권한이 꺼져 있어요. 그래서 이 서버의 S3·DynamoDB 같은 AWS 서비스 호출이 막혀요.
              </p>
            )}
            <button
              type="button"
              onClick={() => onFocusNodes([connection.iamNodeId])}
              className="mt-1.5 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              역할에서 수정 →
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        권한은 역할에서 한 번에 관리해요. 서버와 역할의 연결은 캔버스에서 선을 이어 바꿀 수 있어요.
      </p>
    </div>
  );
}
