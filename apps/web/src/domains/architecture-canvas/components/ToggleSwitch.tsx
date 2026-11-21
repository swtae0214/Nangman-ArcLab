"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onToggle: () => void;
  label: string;
  title?: string;
  /** 같은 모서리에 여러 개를 쌓을 때(트래픽 흐름 보기 + RPS 표시 등) 위치를 다르게 잡는 용도. */
  className?: string;
}

/**
 * 캔버스 좌상단에 뜨는 알약형 토글 스위치 — "트래픽 흐름 보기"에서 처음 만들었고, "트래픽(RPS)
 * 표시"도 똑같은 모양이 필요해서 공용으로 뺐다. Tailwind의 translate-x-* 유틸이 빌드 타이밍에
 * 따라 안 먹는 경우가 있어서, 손잡이 위치는 숫자(px) 인라인 style로 고정한다.
 */
export function ToggleSwitch({ checked, onToggle, label, title, className }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      title={title}
      className={`absolute z-10 flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 ${className ?? ""}`}
    >
      <span className="relative shrink-0 rounded-full transition-colors" style={{ width: 36, height: 20, backgroundColor: checked ? "#16a34a" : "#d1d5db" }}>
        <span
          className="absolute rounded-full bg-white transition-transform"
          style={{ width: 16, height: 16, top: 2, left: 2, transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
      <span className="text-gray-600 dark:text-gray-300">{label}</span>
    </button>
  );
}
