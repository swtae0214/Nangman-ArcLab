"use client";

import type { SelectedElementInfo } from "../types";

/**
 * 14단계: 컴퓨트 노드(웹 서버/Lambda 등) 전용 인스펙터 — 이 노드와 연결된 IAM 노드마다 "권한이
 * 실제로 부여되어 있는지" 토글한다. 꺼두면(권한 없음) "트래픽 흐름 보기"가 이 노드 뒤쪽을 빨간
 * 점선+✕로 보여준다(graph의 iamPermissionGranted 필드, traffic-path.ts의 computeTrafficFlowEdges 참고).
 */
export function IamInspectorSection({
  elementInfo,
  onUpdateEdgeTraffic,
}: {
  elementInfo: SelectedElementInfo;
  onUpdateEdgeTraffic: (edgeIds: string[], patch: { iamPermissionGranted?: boolean }) => void;
}) {
  const connections = elementInfo.iamConnections ?? [];
  if (connections.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">IAM 연결</p>
      <div className="flex flex-col gap-2">
        {connections.map((connection) => (
          <div
            key={connection.edgeId}
            className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs dark:border-gray-700"
          >
            <span className="truncate text-gray-700 dark:text-gray-200">{connection.iamNodeLabel}</span>
            <button
              type="button"
              onClick={() => onUpdateEdgeTraffic([connection.edgeId], { iamPermissionGranted: !connection.granted })}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                connection.granted
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-300"
              }`}
            >
              {connection.granted ? "✓ 권한 있음" : "✕ 권한 없음"}
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
        &ldquo;권한 없음&rdquo;으로 끄면 트래픽 흐름 보기에서 이 노드 뒤쪽이 막힌 것으로 표시돼요.
      </p>
    </div>
  );
}
