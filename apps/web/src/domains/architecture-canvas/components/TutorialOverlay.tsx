"use client";

import type { ArchitectureGraph } from "@nangman/shared-types";
import { useEffect, useMemo, useState } from "react";

interface TutorialStep {
  title: string;
  description: string;
  /** 하이라이트할 실제 DOM 요소를 찾는 CSS 선택자(document.querySelector에 그대로 넘긴다). null이면 하이라이트 없이 가운데에 뜬다. */
  targetSelector: string | null;
  /** 사용자가 이 단계를 실제로 해냈는지 — 그래프/검증 상태를 보고 판단한다(조작 감지). */
  isComplete: (graph: ArchitectureGraph, hasValidated: boolean) => boolean;
  /** 조작 감지 없이 그냥 읽어보는 참고 항목 목록(마지막 "더 알아두면 좋은 기능" 단계 전용). */
  tips?: string[];
}

const LOAD_BALANCER_DEFAULT_LABEL = "로드밸런서";

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: "1. 로드밸런서 놓아보기",
    description: '왼쪽 팔레트에서 "로드밸런서"를 캔버스로 드래그해서 놓아보세요.',
    targetSelector: '[data-tutorial-id="palette-component-LOAD_BALANCER"]',
    isComplete: (graph) => graph.nodes.some((node) => node.type === "LOAD_BALANCER"),
  },
  {
    title: "2. 웹 서버 연결하기",
    description: '이번엔 "웹 서버 (EC2)"를 캔버스에 놓고, 로드밸런서 테두리의 점을 드래그해서 웹 서버와 이어보세요.',
    targetSelector: '[data-tutorial-id="palette-component-WEB_SERVER"]',
    isComplete: (graph) => {
      const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
      return graph.edges.some((edge) => {
        const types = [nodesById.get(edge.source)?.type, nodesById.get(edge.target)?.type];
        return types.includes("LOAD_BALANCER") && types.includes("WEB_SERVER");
      });
    },
  },
  {
    title: "3. 연결선에 설명 붙이기",
    description: '방금 그은 연결선을 더블클릭하면 글자를 쓸 수 있어요. "트래픽"처럼 짧게 역할을 적어보세요.',
    targetSelector: ".react-flow__edge-path",
    isComplete: (graph) => graph.edges.some((edge) => typeof edge.label === "string" && edge.label.trim() !== ""),
  },
  {
    title: "4. 리소스 이름 바꾸기",
    description: '로드밸런서 아래 이름표를 더블클릭하면 이름을 바꿀 수 있어요. 원하는 이름으로 바꿔보세요.',
    targetSelector: ".react-flow__node-LOAD_BALANCER",
    isComplete: (graph) =>
      graph.nodes.some((node) => node.type === "LOAD_BALANCER" && node.data.label !== LOAD_BALANCER_DEFAULT_LABEL),
  },
  {
    title: "5. 검증하기",
    description: '오른쪽 위 "검증하기" 버튼을 눌러서, 지금 만든 구조에 문제가 없는지 확인해보세요.',
    targetSelector: '[data-tutorial-id="validate-button"]',
    isComplete: (_graph, hasValidated) => hasValidated,
  },
  {
    title: "6. 더 알아두면 좋은 기능",
    description: "핵심 조작은 다 해봤어요! 아래 기능들도 알아두면 편해요.",
    targetSelector: null,
    // 조작 감지 대상이 아니라, "다음"을 눌러야만 넘어간다.
    isComplete: () => false,
    tips: ["🌙 다크/라이트 모드 전환 — 오른쪽 위 버튼", "🖼️ PNG/PDF로 내보내기", "🔗 공유 링크 만들기"],
  },
];

/** 하이라이트할 요소가 화면 어디에 있는지 — 패널이 접히고 펼쳐지는 애니메이션 중에도 다시 잰다. */
function useTargetRect(targetSelector: string | null): DOMRect | null {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!targetSelector) return;
    const timer = setInterval(() => setTick((value) => value + 1), 200);
    return () => clearInterval(timer);
  }, [targetSelector]);

  return useMemo(() => {
    if (!targetSelector) return null;
    const element = document.querySelector(targetSelector);
    return element ? element.getBoundingClientRect() : null;
    // tick은 "강제로 다시 재는 용도"라 값 자체는 안 쓰지만, deps에 넣어야 재계산이 일어난다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSelector, tick]);
}

interface TutorialOverlayProps {
  graph: ArchitectureGraph;
  hasValidated: boolean;
  onClose: () => void;
}

/**
 * 11단계(온보딩): 연습용 아키텍처 위에서 실제로 컴포넌트를 놓고 연결해보며 ArcLab 사용법을 익히는
 * 오버레이. 평소엔 그래프/검증 상태를 보고 자동으로 다음 단계로 넘어가지만(조작 감지), 혹시 감지가
 * 안 먹히거나 사용자가 건너뛰고 싶을 때를 위해 "이전/다음" 버튼도 같이 둔다.
 */
export function TutorialOverlay({ graph, hasValidated, onClose }: TutorialOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const isDone = stepIndex >= TUTORIAL_STEPS.length;
  const currentStep = isDone ? null : TUTORIAL_STEPS[stepIndex];

  useEffect(() => {
    if (!currentStep) return;
    if (currentStep.isComplete(graph, hasValidated)) {
      // graph/hasValidated는 캔버스에서 사용자가 실제로 조작한 결과(외부 이벤트)라, 그 변화를 감지해
      // 다음 단계로 넘기는 이 효과는 "props에서 그대로 파생되는 상태"가 아니라 정당한 구독 용도다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex((index) => index + 1);
    }
  }, [graph, hasValidated, currentStep]);

  const targetRect = useTargetRect(currentStep?.targetSelector ?? null);

  const cardWidth = 288;
  const cardEstimatedHeight = 170;
  const viewportWidth = typeof window === "undefined" ? 0 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;

  const cardStyle = (() => {
    if (!targetRect) {
      // 타겟을 아직 못 찾았거나(레이아웃 전환 중) 마지막 완료 화면이면, 화면 가운데에 띄운다.
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const left = Math.min(Math.max(targetRect.left, 16), viewportWidth - cardWidth - 16);
    const spaceBelow = viewportHeight - targetRect.bottom;
    const top =
      spaceBelow > cardEstimatedHeight + 16 ? targetRect.bottom + 12 : Math.max(16, targetRect.top - cardEstimatedHeight - 12);
    return { top: `${top}px`, left: `${left}px` };
  })();

  return (
    <>
      {/* 캔버스/팔레트 조작을 막으면 안 되니, 하이라이트 테두리는 클릭을 그냥 통과시킨다. */}
      {targetRect && (
        <div
          className="pointer-events-none fixed z-40 rounded-md ring-4 ring-blue-400 ring-offset-2 transition-all duration-200"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />
      )}
      <div
        className="fixed z-40 w-72 rounded-lg border border-blue-300 bg-white p-4 text-sm shadow-xl dark:border-blue-700 dark:bg-gray-800"
        style={cardStyle}
      >
        {isDone ? (
          <>
            <p className="mb-1 font-bold text-gray-900 dark:text-gray-100">🎉 튜토리얼 완료!</p>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">
              컴포넌트 배치 · 연결 · 검증까지, ArcLab의 기본 사용법을 익혔어요.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
            >
              닫기
            </button>
          </>
        ) : (
          <>
            <div className="mb-1 flex items-center justify-between">
              <p className="font-bold text-gray-900 dark:text-gray-100">{currentStep!.title}</p>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                {stepIndex + 1}/{TUTORIAL_STEPS.length}
              </span>
            </div>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-300">{currentStep!.description}</p>
            {currentStep!.tips && (
              <ul className="mb-3 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                {currentStep!.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
                disabled={stepIndex === 0}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs disabled:opacity-40 dark:border-gray-600 dark:text-gray-200"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setStepIndex((index) => index + 1)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-600 dark:text-gray-200"
              >
                다음
              </button>
              <button type="button" onClick={onClose} className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500">
                건너뛰기
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
