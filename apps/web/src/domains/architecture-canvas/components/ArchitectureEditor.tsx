"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useEditorTheme } from "@/lib/use-editor-theme";
import { useArchitectureEditor } from "../hooks/useArchitectureEditor";
import { useValidation } from "../hooks/useValidation";
import { useRunSimulation } from "../hooks/useSimulation";
import { ArchitectureCanvas } from "./ArchitectureCanvas";
import { CapacityCalculator } from "./CapacityCalculator";
import { EditableLabel } from "./EditableLabel";
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
  const router = useRouter();
  const { data: currentUser, isLoading: isLoadingUser } = useCurrentUser();
  const { query, saveStatus, handleGraphChange, handleRename } = useArchitectureEditor(id, {
    enabled: currentUser != null,
  });
  const validation = useValidation(id);
  const runSimulation = useRunSimulation(id);
  const [activeTab, setActiveTab] = useState<SidePanelTab>("validation");
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useEditorTheme();

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

  // 깃헙 로그인이 필수인 화면이라, 로그인 안 된 게 확인되면 마케팅 홈으로 돌려보낸다.
  useEffect(() => {
    if (!isLoadingUser && currentUser === null) {
      router.replace("/");
    }
  }, [isLoadingUser, currentUser, router]);

  const themeClassName = theme === "dark" ? "dark" : "";

  if (isLoadingUser || !currentUser || query.isLoading) {
    return (
      <div className={themeClassName}>
        <div className="p-8 dark:bg-gray-900 dark:text-gray-100">불러오는 중...</div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className={themeClassName}>
        <div className="p-8 dark:bg-gray-900">
          <p className="text-red-600 dark:text-red-400">{query.error?.message ?? "아키텍처를 불러오지 못했습니다."}</p>
          <Link href="/architectures" className="mt-2 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← 목록으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen flex-col bg-white dark:bg-gray-900 ${themeClassName}`}>
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-2 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <Link href="/architectures" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            ← 목록
          </Link>
          <h1>
            <EditableLabel
              value={query.data.name}
              onChange={handleRename}
              className="text-sm font-semibold dark:text-gray-100"
              inputClassName="text-sm font-semibold dark:bg-gray-800 dark:text-gray-100"
            />
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500">{SAVE_STATUS_LABEL[saveStatus]}</span>
          <button
            type="button"
            onClick={toggleTheme}
            title={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {theme === "dark" ? "☀️ 라이트 모드" : "🌙 다크 모드"}
          </button>
          <ExportButton targetRef={exportContainerRef} fileName={query.data.name} />
          <ShareButton architectureId={id} isPublic={query.data.isPublic} shareToken={query.data.shareToken} />
          <button
            type="button"
            onClick={() => {
              setActiveTab("validation");
              validation.mutate();
            }}
            disabled={validation.isPending}
            className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900"
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
            colorMode={theme}
          />
        </div>
        <aside className="flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex border-b border-gray-200 text-xs dark:border-gray-700">
            <button
              type="button"
              onClick={() => setActiveTab("validation")}
              className={`flex-1 px-2 py-2 font-medium ${
                activeTab === "validation"
                  ? "border-b-2 border-black text-black dark:border-gray-100 dark:text-gray-100"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              정적 검증
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("capacity")}
              className={`flex-1 px-2 py-2 font-medium ${
                activeTab === "capacity"
                  ? "border-b-2 border-black text-black dark:border-gray-100 dark:text-gray-100"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              용량 계산기
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("simulation")}
              className={`flex-1 px-2 py-2 font-medium ${
                activeTab === "simulation"
                  ? "border-b-2 border-black text-black dark:border-gray-100 dark:text-gray-100"
                  : "text-gray-400 dark:text-gray-500"
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
                <p className="p-3 text-xs text-gray-400 dark:text-gray-500">
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
