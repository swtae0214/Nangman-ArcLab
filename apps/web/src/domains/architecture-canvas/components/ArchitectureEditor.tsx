"use client";

import type { ArchitectureGraph } from "@nangman/shared-types";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { TutorialOverlay } from "./TutorialOverlay";
import { ValidationResultList } from "./ValidationResultList";

const EMPTY_GRAPH: ArchitectureGraph = { nodes: [], edges: [] };

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
  /**
   * 10단계: 설계할 땐 오른쪽 패널(검증/용량/시뮬레이션)을 안 쓰는 경우가 많아서 접을 수 있게 했다.
   * - "pinned": 기본값. 항상 펼쳐진 채로 캔버스 폭을 차지한다.
   * - "collapsed": 접기 버튼을 누른 뒤. 평소엔 얇은 띠만 남고, 그 띠에 마우스를 올리면 캔버스 위에
   *   떠서(레이아웃 폭은 그대로) 미리보기처럼 펼쳐진다. 다시 고정하고 싶으면 미리보기 안의 핀 버튼.
   */
  const [rightPanelMode, setRightPanelMode] = useState<"pinned" | "collapsed">("pinned");
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useEditorTheme();

  /**
   * 11단계(온보딩 튜토리얼): 대시보드의 "튜토리얼" 링크가 새 연습용 아키텍처를 만들고
   * ?tutorial=1로 이 화면을 열면, 오버레이가 자동으로 뜬다. router.push 직후 첫 렌더 시점엔
   * window.location이 아직 이전 경로일 수 있어서(클라이언트 사이드 전환 타이밍), 매번 최신 쿼리를
   * 안전하게 읽어주는 useSearchParams를 쓴다.
   */
  const searchParams = useSearchParams();
  const [isTutorialOpen, setIsTutorialOpen] = useState(() => searchParams.get("tutorial") === "1");
  // 튜토리얼의 조작 감지(드래그/연결 여부)가 그래프 내용을 실시간으로 봐야 해서, 변경될 때마다 따로 들고 있는다.
  const [liveGraph, setLiveGraph] = useState<ArchitectureGraph>(EMPTY_GRAPH);
  const handleGraphChangeWithTutorial = useCallback(
    (graph: ArchitectureGraph) => {
      handleGraphChange(graph);
      setLiveGraph(graph);
    },
    [handleGraphChange],
  );

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

  const tabBar = (
    <div className="flex flex-1 items-center text-xs">
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
  );

  const tabContent = (
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
  );

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
            // 튜토리얼 오버레이가 이 버튼을 하이라이트할 때 찾는 식별자.
            data-tutorial-id="validate-button"
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
            onGraphChange={handleGraphChangeWithTutorial}
            problemNodeIds={problemNodeIds}
            exportContainerRef={exportContainerRef}
            colorMode={theme}
          />
        </div>
        {rightPanelMode === "collapsed" ? (
          // 10단계: 레이어 패널이 고정돼 있을 때 이 패널을 호버로 펼치면, 캔버스 위에 떠서 레이어
          // 패널과 어색하게 겹치거나 그 일부가 가려 보이던 문제가 있었다 — 캔버스 위로 "뜨는" 대신
          // 실제 레이아웃 폭을 늘려서 레이어 패널 바로 옆에 자연스럽게 나타나도록 바꿨다. 평소엔 얇은
          // 손잡이(20px)만 차지하고, 호버하면 그 옆 칸이 0→320px로 넓어지며(overflow-hidden으로
          // 가려뒀던 내용이 점점 드러나는 방식) 캔버스가 그만큼 잠깐 좁아진다.
          <div className="group flex h-full shrink-0">
            <div className="flex h-full w-5 shrink-0 flex-col items-center border-l border-gray-200 bg-white pt-3 dark:border-gray-700 dark:bg-gray-900">
              <span className="text-base text-gray-400 dark:text-gray-500">‹</span>
            </div>
            <div className="flex h-full w-0 shrink-0 flex-col overflow-hidden transition-[width] duration-200 ease-out delay-150 group-hover:w-80 group-hover:delay-0">
              <div className="flex h-full w-80 shrink-0 flex-col border-l border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
                  {tabBar}
                  <button
                    type="button"
                    onClick={() => setRightPanelMode("pinned")}
                    title="패널 고정하기"
                    aria-label="패널 고정하기"
                    className="m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base text-gray-500 shadow-sm hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
                  >
                    📌
                  </button>
                </div>
                {tabContent}
              </div>
            </div>
          </div>
        ) : (
          // 고정된 상태일 땐 z-30을 줘서, 왼쪽에 접혀 있는 레이어 패널의 호버 미리보기(z-20)가 이 패널 위를 덮지 못하게 한다.
          <aside className="relative z-30 flex w-80 shrink-0 flex-col border-l border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center border-b border-gray-200 dark:border-gray-700">
              {tabBar}
              <button
                type="button"
                onClick={() => setRightPanelMode("collapsed")}
                title="패널 접기"
                aria-label="패널 접기"
                className="m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-base text-gray-500 shadow-sm hover:border-blue-400 hover:text-blue-600 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400"
              >
                ›
              </button>
            </div>
            {tabContent}
          </aside>
        )}
      </div>
      {isTutorialOpen && (
        <TutorialOverlay
          graph={liveGraph}
          hasValidated={validation.data != null}
          onClose={() => setIsTutorialOpen(false)}
        />
      )}
    </div>
  );
}
