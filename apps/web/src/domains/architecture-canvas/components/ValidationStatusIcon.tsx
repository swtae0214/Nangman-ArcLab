"use client";

import { STATUS_ICON_COLOR } from "../validation-style";

export type ValidationRowStatus = "passed" | "violated-critical" | "violated-warning" | "violated-info" | "not-applicable";

/**
 * 정적 검증 탭 시각 처리 정리(V4): 글자 ✓/▲ 대신 상태별 SVG 아이콘. 색만으로 구분하지 않도록
 * 모양(원/삼각형/마름모)도 서로 다르게 두고, 스크린 리더용 aria-label을 always 붙인다.
 */
export function ValidationStatusIcon({ status, size = 18 }: { status: ValidationRowStatus; size?: number }) {
  if (status === "passed") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" role="img" aria-label="통과" className="shrink-0">
        <circle cx="9" cy="9" r="9" fill={STATUS_ICON_COLOR.passed} />
        <path d="M5 9.3L7.6 12 13 6" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (status === "violated-critical") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" role="img" aria-label="위반" className="shrink-0">
        <rect x="3.1" y="3.1" width="11.8" height="11.8" rx="2" fill={STATUS_ICON_COLOR.violatedCritical} transform="rotate(45 9 9)" />
        <rect x="8.3" y="4.8" width="1.4" height="5" rx="0.7" fill="white" />
        <circle cx="9" cy="12.2" r="0.85" fill="white" />
      </svg>
    );
  }

  if (status === "violated-warning") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" role="img" aria-label="위반" className="shrink-0">
        <path d="M9 2.2L16.3 15H1.7L9 2.2Z" fill={STATUS_ICON_COLOR.violatedWarning} />
        <rect x="8.3" y="7" width="1.4" height="3.8" rx="0.7" fill="white" />
        <circle cx="9" cy="12.3" r="0.85" fill="white" />
      </svg>
    );
  }

  if (status === "violated-info") {
    return (
      <svg width={size} height={size} viewBox="0 0 18 18" role="img" aria-label="위반" className="shrink-0">
        <circle cx="9" cy="9" r="9" fill={STATUS_ICON_COLOR.violatedInfo} />
        <rect x="8.3" y="7" width="1.4" height="3.8" rx="0.7" fill="white" />
        <circle cx="9" cy="12.3" r="0.85" fill="white" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 18 18" role="img" aria-label="해당 없음" className="shrink-0">
      <circle cx="9" cy="9" r="7.2" fill="none" stroke={STATUS_ICON_COLOR.notApplicable} strokeWidth="1.4" />
      <rect x="5.3" y="8.3" width="7.4" height="1.4" rx="0.7" fill={STATUS_ICON_COLOR.notApplicable} />
    </svg>
  );
}

/** V7: 글자 ▾/▴ 대신 16px 화살표 — 보조 텍스트색, isOpen이면 90도 돌아간다. */
export function ChevronIcon({ isOpen, size = 16 }: { isOpen: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={`shrink-0 text-gray-400 transition-transform dark:text-gray-500 ${isOpen ? "rotate-90" : ""}`}
      aria-hidden
    >
      <path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
