import Link from "next/link";
import type { ArchitectureDashboardSummary } from "@nangman/shared-types";
import { formatRelativeTimeKo } from "@/lib/format-relative-time";
import { SEVERITY_BADGE_BG_STYLE, SEVERITY_TEXT_CLASS } from "@/lib/severity-colors";

interface ArchitectureCardProps {
  architecture: ArchitectureDashboardSummary;
  /** 바로 지우지 않고, 삭제할지 확인하는 창을 띄우라는 요청만 부모에 올린다. */
  onDeleteRequest: (architecture: ArchitectureDashboardSummary) => void;
}

/**
 * 카드 썸네일은 실제 캔버스 스냅샷이 아직 없어서(design_handoff_home_dashboard/README.md의
 * Assets 섹션: "실제 캔버스 스냅샷 이미지로 교체 필요") 디자인과 같은 빗금 placeholder를 쓴다.
 */
export function ArchitectureCard({ architecture, onDeleteRequest }: ArchitectureCardProps) {
  const { validation, latestSimulation } = architecture;
  const hasViolation = validation.failedCount > 0;

  return (
    <div className="group overflow-hidden rounded-lg border border-console-accent/20 bg-console-panel">
      <Link href={`/architectures/${architecture.id}`}>
        <div
          className="flex h-[120px] items-center justify-center border-b border-console-accent/15 font-jetbrains text-[11px] font-semibold text-console-accent"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, rgba(90,255,158,.07) 0 8px, transparent 8px 16px)",
          }}
        >
          캔버스 미리보기
        </div>
        <div className="px-[18px] py-4">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <span className="truncate text-[15px] font-bold text-white">{architecture.name}</span>
            <span className="flex-shrink-0 font-jetbrains text-[13px] font-bold text-console-accent">
              {latestSimulation ? `${latestSimulation.estimatedAvailabilityPercent.toFixed(1)}%` : "—"}
            </span>
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
      <button
        type="button"
        onClick={() => onDeleteRequest(architecture)}
        className="w-full border-t border-console-accent/10 px-[18px] py-2 text-left text-[11.5px] text-console-muted opacity-0 transition-opacity hover:text-console-critical group-hover:opacity-100"
      >
        삭제
      </button>
    </div>
  );
}
