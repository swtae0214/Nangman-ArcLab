import Link from "next/link";
import type { ArchitectureDashboardSummary } from "@nangman/shared-types";
import { SEVERITY_BADGE_BG_STYLE, SEVERITY_TEXT_CLASS } from "@/lib/severity-colors";

interface ArchitectureViolationsPanelProps {
  architectures: ArchitectureDashboardSummary[];
}

/** 규칙 카탈로그 자체가 아니라, 내 아키텍처들이 실제로 무슨 규칙을 위반했는지 이름별로 보여준다. */
export function ArchitectureViolationsPanel({ architectures }: ArchitectureViolationsPanelProps) {
  const withViolations = architectures.filter((architecture) => architecture.validation.failedRules.length > 0);

  return (
    <div className="rounded-lg border border-console-accent/15 bg-console-panel px-6 py-[22px]">
      <div className="mb-3.5 font-jetbrains text-xs font-bold tracking-wide text-console-muted">
        아키텍처별 위반 규칙
      </div>

      {withViolations.length === 0 ? (
        <p className="text-[13px] leading-[1.6] text-console-subtle">
          {architectures.length === 0
            ? "아직 만든 아키텍처가 없어요."
            : "위반 규칙이 없어요. 모든 아키텍처가 정적 검증을 통과했어요."}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {withViolations.map((architecture) => (
            <div key={architecture.id} className="border-b border-console-accent/8 pb-3.5 last:border-b-0 last:pb-0">
              <Link
                href={`/architectures/${architecture.id}`}
                className="mb-2 block truncate text-[13.5px] font-bold text-white hover:text-console-accent"
              >
                {architecture.name}
              </Link>
              <div className="flex flex-wrap gap-1.5">
                {architecture.validation.failedRules.map((rule) => (
                  <span
                    key={rule.ruleCode}
                    style={{ backgroundColor: SEVERITY_BADGE_BG_STYLE[rule.severity] }}
                    className={`rounded px-2 py-1 font-jetbrains text-[10.5px] font-semibold ${SEVERITY_TEXT_CLASS[rule.severity]}`}
                  >
                    {rule.ruleCode} <span className="opacity-70">{rule.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
