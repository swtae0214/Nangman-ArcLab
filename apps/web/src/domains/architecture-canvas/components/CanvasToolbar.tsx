"use client";

export type CanvasInteractionMode = "select" | "pan";

interface CanvasToolbarProps {
  mode: CanvasInteractionMode;
  onModeChange: (mode: CanvasInteractionMode) => void;
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onUndo: () => void;
  onRedo: () => void;
  isLocked: boolean;
  onToggleLock: () => void;
  /** 피그마의 Text 도구처럼, 누르면 화면 가운데에 텍스트 박스를 바로 하나 놓는다. */
  onAddTextBox: () => void;
  /** 공유 링크로 보는 읽기 전용 화면에서는 확대/축소·화면 맞춤만 남기고 편집 관련 버튼은 숨긴다. */
  readOnly?: boolean;
}

const BUTTON_CLASS =
  "flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700";
const ACTIVE_BUTTON_CLASS = "flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300";
const DIVIDER_CLASS = "mx-2 h-7 w-px bg-gray-200 dark:bg-gray-700";

function SelectIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 3l6 17 2.5-6.5L20 11 5 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 11V5a1.5 1.5 0 0 1 3 0v5m0-3V4a1.5 1.5 0 0 1 3 0v6m0-4a1.5 1.5 0 0 1 3 0v5m0-2a1.5 1.5 0 0 1 3 0v6c0 3.3-2.2 6-6 6s-5.5-1.5-7-4l-2-4c-.5-1 0-2 1-2.3 1-.3 1.7.1 2.3 1l.7 1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FitViewIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M9 3H5a2 2 0 0 0-2 2v4M15 3h4a2 2 0 0 1 2 2v4M9 21H5a2 2 0 0 1-2-2v-4M15 21h4a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 10H16a5 5 0 0 1 0 10h-1M7 10l4-4M7 10l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 10H8a5 5 0 0 0 0 10h1M17 10l-4-4M17 10l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TextBoxToolIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <text x="12" y="18.5" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="20" fontWeight="600">
        T
      </text>
    </svg>
  );
}

function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.8" />
      {locked ? (
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M8 11V7a4 4 0 0 1 7.5-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** 캔버스 하단 중앙에 뜨는 도구 모음 — 선택/이동(손) 도구 전환, 확대·축소, 화면 맞춤, 실행취소/다시실행, 잠금. */
export function CanvasToolbar({
  mode,
  onModeChange,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFitView,
  onUndo,
  onRedo,
  isLocked,
  onToggleLock,
  onAddTextBox,
  readOnly = false,
}: CanvasToolbarProps) {
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-gray-200 bg-white px-2.5 py-2 shadow-md dark:border-gray-700 dark:bg-gray-800">
      {!readOnly && (
        <>
          <button
            type="button"
            title="이동 (V)"
            aria-pressed={mode === "select"}
            onClick={() => onModeChange("select")}
            className={mode === "select" ? ACTIVE_BUTTON_CLASS : BUTTON_CLASS}
          >
            <SelectIcon />
          </button>
          <button
            type="button"
            title="손 도구 (H)"
            aria-pressed={mode === "pan"}
            onClick={() => onModeChange("pan")}
            className={mode === "pan" ? ACTIVE_BUTTON_CLASS : BUTTON_CLASS}
          >
            <HandIcon />
          </button>
          <button type="button" title="텍스트 박스 추가" onClick={onAddTextBox} className={BUTTON_CLASS}>
            <TextBoxToolIcon />
          </button>
          <div className={DIVIDER_CLASS} />
        </>
      )}
      <button type="button" title="축소" onClick={onZoomOut} className={BUTTON_CLASS}>
        <MinusIcon />
      </button>
      <span className="w-14 shrink-0 text-center text-sm font-medium text-gray-600 dark:text-gray-300">{zoomPercent}%</span>
      <button type="button" title="확대" onClick={onZoomIn} className={BUTTON_CLASS}>
        <PlusIcon />
      </button>
      <button type="button" title="화면에 맞추기" onClick={onFitView} className={BUTTON_CLASS}>
        <FitViewIcon />
      </button>
      {!readOnly && (
        <>
          <div className={DIVIDER_CLASS} />
          <button type="button" title="실행 취소 (Ctrl+Z)" onClick={onUndo} className={BUTTON_CLASS}>
            <UndoIcon />
          </button>
          <button type="button" title="다시 실행 (Ctrl+Y)" onClick={onRedo} className={BUTTON_CLASS}>
            <RedoIcon />
          </button>
          <div className={DIVIDER_CLASS} />
          <button
            type="button"
            title={isLocked ? "캔버스 잠금 해제" : "캔버스 잠그기 (실수로 옮기는 것 방지)"}
            aria-pressed={isLocked}
            onClick={onToggleLock}
            className={isLocked ? ACTIVE_BUTTON_CLASS : BUTTON_CLASS}
          >
            <LockIcon locked={isLocked} />
          </button>
        </>
      )}
    </div>
  );
}
