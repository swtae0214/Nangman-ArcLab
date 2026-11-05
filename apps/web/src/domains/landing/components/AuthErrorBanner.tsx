"use client";

import { useEffect, useState } from "react";

const AUTH_ERROR_MESSAGES: Record<string, { tone: "warning" | "critical"; message: string }> = {
  access_denied: {
    tone: "warning",
    message: "GitHub 로그인을 취소하셨어요. 다시 로그인하려면 위 버튼을 눌러주세요.",
  },
  invalid_state: {
    tone: "critical",
    message: "로그인 요청이 만료됐거나 올바르지 않아요. 다시 시도해주세요.",
  },
  login_failed: {
    tone: "critical",
    message: "로그인 처리 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.",
  },
};

const TONE_CLASS: Record<"warning" | "critical", string> = {
  warning: "border-[#ffc85a]/40 bg-console-warning/10 text-console-warning",
  critical: "border-[#ff5a5a]/40 bg-console-critical/10 text-console-critical",
};

/**
 * /auth/github/callback이 실패하면 "/?auth_error=코드"로 돌려보낸다. 예전엔 이 코드가 화면에
 * 전혀 안 보여서(서버 로그를 직접 봐야만 원인을 알 수 있었다) 실제로 디버깅에 한참 걸렸던 적이
 * 있어서, 여기서 사람이 읽을 수 있는 메시지로 바꿔 보여준다. useSearchParams 대신 window.location을
 * 직접 읽는 이유: "/"는 정적 프리렌더 페이지라 useSearchParams를 쓰려면 Suspense 경계가 따로
 * 필요한데, 이 배너는 화면 표시용이라 그렇게까지 할 필요 없이 마운트 후 한 번만 읽으면 충분하다.
 */
export function AuthErrorBanner() {
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // 쿼리 파라미터는 서버 렌더 시점엔 알 수 없는(window가 없는) 값이라, 최초 렌더는 항상
    // null(= 배너 없음)로 서버와 클라이언트가 일치시키고, 마운트가 끝난 뒤 이 effect에서만
    // 읽어와 보여준다 — 그래야 하이드레이션 불일치가 안 생긴다.
    const code = new URLSearchParams(window.location.search).get("auth_error");
    if (code) {
      // 브라우저 전용 값(location)을 읽어와 동기화하는 경우라 effect에서의 setState가 의도된 사용이다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErrorCode(code);
      // 새로고침해도 배너가 계속 뜨지 않도록 주소창에서 쿼리를 지운다.
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!errorCode || isDismissed) return null;

  const info = AUTH_ERROR_MESSAGES[errorCode] ?? {
    tone: "critical" as const,
    message: "로그인 중 알 수 없는 문제가 발생했어요. 다시 시도해주세요.",
  };

  return (
    <div className={`mx-10 mt-6 flex items-center justify-between gap-3 rounded-md border px-4 py-3 text-[13px] ${TONE_CLASS[info.tone]}`}>
      <span>{info.message}</span>
      <button type="button" onClick={() => setIsDismissed(true)} className="text-[12px] opacity-70 hover:opacity-100">
        닫기
      </button>
    </div>
  );
}
