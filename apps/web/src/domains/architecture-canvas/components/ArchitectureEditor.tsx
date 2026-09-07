"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useArchitectureEditor } from "../hooks/useArchitectureEditor";
import { useValidation } from "../hooks/useValidation";
import { useRunSimulation } from "../hooks/useSimulation";
import { ArchitectureCanvas } from "./ArchitectureCanvas";
import { CapacityCalculator } from "./CapacityCalculator";
import { ExportButton } from "./ExportButton";
import { ShareButton } from "./ShareButton";
import { SimulationPanel } from "./SimulationPanel";
import { ValidationResultList } from "./ValidationResultList";

const SAVE_STATUS_LABEL: Record<string, string> = {
  idle: "",
  saving: "저장 중...",
  saved: "저장됨",
  error: "저장 실패",
};

type SidePanelTab = "validation" | "capacity" | "simulation";

export function ArchitectureEditor({ id }: { id: string }) {
  const { query, saveStatus, handleGraphChange } = useArchitectureEditor(id);
  const validation = useValidation(id);
  const runSimulation = useRunSimulation(id);
  const [activeTab, setActiveTab] = useState<SidePanelTab>("validation");
  const exportContainerRef = useRef<HTMLDivElement>(null);

  const problemNodeIds = useMemo(() => {
    const ids = new Set<string>();
    const reports = [validation.data, runSimulation.data?.validation];
    for (const report of reports) {
      for (const result of report?.results ?? []) {
        if (!result.passed) {
          for (const nodeId of result.detail.nodeIds ?? []) ids.add(nodeId);
        }
      }
    }
    return ids;
  }, [validation.data, runSimulation.data]);

  if (query.isLoading) {
    return <div className="p-8">불러오는 중...</div>;
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-8">
        <p className="text-red-600">{query.error?.message ?? "아키텍처를 불러오지 못했습니다."}</p>
        <Link href="/architectures" className="mt-2 inline-block text-sm text-blue-600 hover:underline">
          ← 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <div className="flex items-center gap-3">
          <Link href="/architectures" className="text-sm text-blue-600 hover:underline">
            ← 목록
          </Link>
          <h1 className="text-sm font-semibold">{query.data.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{SAVE_STATUS_LABEL[saveStatus]}</span>
          <ExportButton targetRef={exportContainerRef} fileName={query.data.name} />
          <ShareButton architectureId={id} isPublic={query.data.isPublic} shareToken={query.data.shareToken} />
          <button
            type="button"
            onClick={() => {
              setActiveTab("validation");
              validation.mutate();
            }}
            disabled={validation.isPending}
            className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            {validation.isPending ? "검증 중..." : "검증하기"}
          </button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <ArchitectureCanvas
            initialGraph={query.data.graph}
            onGraphChange={handleGraphChange}
            problemNodeIds={problemNodeIds}
            exportContainerRef={exportContainerRef}
          />
        </div>
        <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200">
          <div className="flex border-b border-gray-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("validation")}
              className={`flex-1 px-2 py-2 font-medium ${
                activeTab === "validation" ? "border-b-2 border-black text-black" : "text-gray-400"
              }`}
            >
              정적 검증
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capacity")}
              className={`flex-1 px-2 py-2 font-medium ${
                activeTab === "capacity" ? "border-b-2 border-black text-black" : "text-gray-400"
              }`}
            >
              용량 계산기
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("simulation")}
              className={`flex-1 px-2 py-2 font-medium ${
                activeTab === "simulation" ? "border-b-2 border-black text-black" : "text-gray-400"
              }`}
            >
              시뮬레이션
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {activeTab === "validation" &&
              (validation.data ? (
                <ValidationResultList report={validation.data} />
              ) : (
                <p className="p-3 text-xs text-gray-400">
                  {validation.isPending ? "검증 중..." : '상단의 "검증하기"를 눌러 정적 검증을 실행하세요.'}
                </p>
              ))}
            {activeTab === "capacity" && <CapacityCalculator />}
            {activeTab === "simulation" && <SimulationPanel architectureId={id} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
