"use client";

import Link from "next/link";
import { useState } from "react";
import type { ArchitectureDashboardSummary } from "@nangman/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { shareArchitecture } from "@/lib/api";
import { formatRelativeTimeKo } from "@/lib/format-relative-time";
import { useDuplicateArchitecture, useRenameArchitecture } from "@/lib/use-architectures";
import { SEVERITY_BADGE_BG_STYLE, SEVERITY_TEXT_CLASS } from "@/lib/severity-colors";
import { ArchitectureCardMenu } from "./ArchitectureCardMenu";
import { ArchitecturePreview } from "./ArchitecturePreview";
import { RenameArchitectureDialog } from "./RenameArchitectureDialog";

interface ArchitectureCardProps {
  architecture: ArchitectureDashboardSummary;
  /** 바로 지우지 않고, 삭제할지 확인하는 창을 띄우라는 요청만 부모에 올린다. */
  onDeleteRequest: (architecture: ArchitectureDashboardSummary) => void;
}

export function ArchitectureCard({ architecture, onDeleteRequest }: ArchitectureCardProps) {
  const { validation, latestSimulation } = architecture;
  const hasViolation = validation.failedCount > 0;
  const [isRenaming, setIsRenaming] = useState(false);

  const queryClient = useQueryClient();
  const renameArchitecture = useRenameArchitecture();
  const duplicateArchitecture = useDuplicateArchitecture();
  const copyShareLink = useMutation({
    mutationFn: () => shareArchitecture(architecture.id),
    onSuccess: (result) => {
      void navigator.clipboard.writeText(result.shareUrl);
      void queryClient.invalidateQueries({ queryKey: ["architectures"] });
    },
  });

  const handleCopyShareLink = () => {
    // 이미 공유 중이면 share()를 다시 안 불러도 된다 — 다시 부르면 토큰이 새로 발급돼서
    // 기존에 공유해둔 링크가 끊긴다.
    if (architecture.isPublic && architecture.shareToken) {
      void navigator.clipboard.writeText(`${window.location.origin}/shared/${architecture.shareToken}`);
      return;
    }
    copyShareLink.mutate();
  };

  return (
    <div className="group rounded-lg border border-console-accent/20 bg-console-panel">
      <Link href={`/architectures/${architecture.id}`}>
        <div className="h-[120px] overflow-hidden rounded-t-lg border-b border-console-accent/15 bg-black/20 p-2">
          <ArchitecturePreview graph={architecture.graph} />
        </div>
        <div className="px-[18px] py-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-bold text-white">{architecture.name}</span>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <span className="font-jetbrains text-[13px] font-bold text-console-accent">
                {latestSimulation ? `${latestSimulation.estimatedAvailabilityPercent.toFixed(1)}%` : "—"}
              </span>
              <ArchitectureCardMenu
                onRename={() => setIsRenaming(true)}
                onDuplicate={() => duplicateArchitecture.mutate(architecture.id)}
                onCopyShareLink={handleCopyShareLink}
                onDeleteRequest={() => onDeleteRequest(architecture)}
              />
            </div>
          </div>
          <div className="mb-3 font-jetbrains text-[11.5px] text-console-muted">
            노드 {architecture.nodeCount} · {formatRelativeTimeKo(architecture.updatedAt)} 저장
          </div>
          {hasViolation ? (
            <span
              className={`inline-block rounded px-2.5 py-1 font-jetbrains text-[10.5px] font-bold ${SEVERITY_TEXT_CLASS[validation.worstSeverity ?? "INFO"]}`}
              style={{ backgroundColor: SEVERITY_BADGE_BG_STYLE[validation.worstSeverity ?? "INFO"] }}
            >
              위반 {validation.failedCount}건 · {validation.worstSeverity}
            </span>
          ) : (
            <span
              className="inline-block rounded px-2.5 py-1 font-jetbrains text-[10.5px] font-bold text-console-accent"
              style={{ backgroundColor: "rgba(90,255,158,.15)" }}
            >
              통과 · 규칙 {validation.totalCount}/{validation.totalCount}
            </span>
          )}
        </div>
      </Link>

      {isRenaming && (
        <RenameArchitectureDialog
          currentName={architecture.name}
          isRenaming={renameArchitecture.isPending}
          errorMessage={renameArchitecture.error?.message ?? null}
          onCancel={() => setIsRenaming(false)}
          onConfirm={(name) =>
            renameArchitecture.mutate({ id: architecture.id, name }, { onSuccess: () => setIsRenaming(false) })
          }
        />
      )}
    </div>
  );
}
