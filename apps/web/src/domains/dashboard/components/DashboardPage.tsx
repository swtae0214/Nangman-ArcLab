"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ArchitectureDashboardSummary } from "@nangman/shared-types";
import { ConsoleNavBar } from "@/components/ConsoleNavBar";
import { useArchitectures, useCreateArchitecture, useDeleteArchitecture } from "@/lib/use-architectures";
import { computeDashboardAggregateStats } from "../dashboard-stats";
import { ArchitectureCard } from "./ArchitectureCard";
import { ArchitectureViolationsPanel } from "./ArchitectureViolationsPanel";
import { CoreFeatureList } from "./CoreFeatureList";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { EmptyStateCard } from "./EmptyStateCard";
import { StatCard } from "./StatCard";

const EMPTY_GRAPH = { nodes: [], edges: [] };

function formatPercent(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)}%`;
}

function formatLatency(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}ms`;
}

export function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ArchitectureDashboardSummary | null>(null);
  const { data: architectures, isLoading, error } = useArchitectures();
  const createArchitecture = useCreateArchitecture();
  const deleteArchitecture = useDeleteArchitecture();

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    deleteArchitecture.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) });
  };

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim() === "") return;
    createArchitecture.mutate(
      { name, graph: EMPTY_GRAPH },
      {
        onSuccess: (created) => {
          setName("");
          router.push(`/architectures/${created.id}`);
        },
      },
    );
  };

  const errorMessage =
    error?.message ?? createArchitecture.error?.message ?? deleteArchitecture.error?.message ?? null;
  const stats = computeDashboardAggregateStats(architectures ?? []);

  return (
    <div className="min-h-screen bg-console-bg font-noto-kr text-console-fg">
      <div className="mx-auto max-w-[1360px]">
        <ConsoleNavBar variant="dashboard" />

        <div className="flex flex-wrap items-end justify-between gap-6 px-10 pt-9 pb-6">
          <div>
            <div className="mb-2 font-jetbrains text-[11.5px] font-semibold text-console-accent">
              ⚡ {stats.architectureCount}개 아키텍처 모니터링 중
            </div>
            <h1 className="text-[27px] font-extrabold text-white">아키텍처 검증 현황</h1>
          </div>
          <form onSubmit={handleCreate} className="flex gap-2.5">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="새 아키텍처 이름"
              className="rounded border border-console-accent/25 bg-console-panel px-3.5 py-3 text-[13.5px] text-console-fg placeholder:text-console-muted focus:border-console-accent focus:outline-none"
            />
            <button
              type="button"
              disabled
              title="템플릿 목록은 아직 준비 중이에요"
              className="cursor-not-allowed rounded border border-console-accent/30 px-5 py-3 text-[13.5px] font-semibold text-console-fg/50"
            >
              템플릿에서 시작
            </button>
            <button
              type="submit"
              disabled={createArchitecture.isPending}
              className="rounded bg-console-accent px-[22px] py-3 text-[13.5px] font-bold text-console-bg hover:bg-console-accent-hover disabled:opacity-60"
            >
              + 새 아키텍처 시작하기
            </button>
          </form>
        </div>

        {errorMessage && <p className="px-10 pb-4 text-sm text-console-critical">{errorMessage}</p>}

        <div className="grid grid-cols-4 gap-3 px-10 pb-7">
          <StatCard label="평균 추정 가용성" value={formatPercent(stats.avgEstimatedAvailabilityPercent)} tone="accent" />
          <StatCard label="평균 지연시간" value={formatLatency(stats.avgLatencyMs)} />
          <StatCard
            label="미해결 위반 규칙"
            value={`${stats.unresolvedViolationCount}건`}
            tone={stats.unresolvedViolationCount > 0 ? "critical" : "accent"}
          />
          <StatCard label="저장된 설계" value={`${stats.architectureCount}개`} />
        </div>

        <div className="px-10 pt-2">
          <div className="mb-3.5 font-jetbrains text-[11px] font-bold tracking-wide text-console-muted">
            내 아키텍처
          </div>
          {isLoading ? (
            <p className="text-sm text-console-muted">불러오는 중...</p>
          ) : architectures && architectures.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {architectures.map((architecture) => (
                <ArchitectureCard key={architecture.id} architecture={architecture} onDeleteRequest={setPendingDelete} />
              ))}
            </div>
          ) : (
            <EmptyStateCard />
          )}
        </div>

        <div className="mt-8 grid grid-cols-[1.4fr_1fr] gap-5 px-10 pb-10">
          <ArchitectureViolationsPanel architectures={architectures ?? []} />
          <CoreFeatureList />
        </div>
      </div>

      {pendingDelete && (
        <DeleteConfirmDialog
          architectureName={pendingDelete.name}
          isDeleting={deleteArchitecture.isPending}
          onCancel={() => setPendingDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
